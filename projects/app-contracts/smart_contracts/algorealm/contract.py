from algopy import ARC4Contract, String, UInt64, Bytes, Account, Asset, GlobalState, LocalState, Txn, Global, log, OnCompleteAction, op
from algopy.arc4 import abimethod, DynamicArray, Address, Bool
from algopy import itxn


class AlgoRealmGameManager(ARC4Contract):
    """
    Main game manager contract for AlgoRealm
    Handles player registration, item management, and on-demand tokenization
    """
    
    def __init__(self) -> None:
        # Global game state
        self.total_players = GlobalState(UInt64)
        self.total_items_created = GlobalState(UInt64)
        self.game_master = GlobalState(Account)
        self.current_season = GlobalState(UInt64)
        self.max_recovery_per_item = GlobalState(UInt64)
        
        # Player local state - using basic types to avoid struct issues
        self.player_level = LocalState(UInt64)
        self.player_experience = LocalState(UInt64)
        self.player_recovery_count = LocalState(UInt64)
        self.is_registered = LocalState(Bool)
    
    @abimethod(create="require")
    def initialize_game(self) -> String:
        """Initialize the game state - called once when contract is created"""
        self.total_players.value = UInt64(0)
        self.total_items_created.value = UInt64(0)
        self.current_season.value = UInt64(1)
        self.max_recovery_per_item.value = UInt64(3)
        self.game_master.value = Txn.sender  # Set the creator as game master
        return String("AlgoRealm initialized!")
    
    @abimethod(allow_actions=["NoOp", "OptIn"])
    def register_player(self, player_name: String) -> String:
        """Register a new player in the game"""
        # Check if this is an opt-in call
        if Txn.on_completion == OnCompleteAction.OptIn:
            # Initialize default values for local state when opting in
            self.player_level[Txn.sender] = UInt64(0)
            self.player_experience[Txn.sender] = UInt64(0)
            self.player_recovery_count[Txn.sender] = UInt64(0)
            self.is_registered[Txn.sender] = Bool(False)
            return String("Opted in to AlgoRealm!")
        
        # For NoOp calls, handle registration
        # Now we can safely access local state since it was initialized on opt-in
        if self.is_registered[Txn.sender]:
            return String("Player already registered")
        
        # Initialize player stats for actual registration
        self.player_level[Txn.sender] = UInt64(1)
        self.player_experience[Txn.sender] = UInt64(0)
        self.player_recovery_count[Txn.sender] = UInt64(0)
        self.is_registered[Txn.sender] = Bool(True)
        
        self.total_players.value += UInt64(1)
        
        log(player_name.bytes)
        return String("Welcome to AlgoRealm!")
    
    @abimethod()
    def create_game_item(
        self, 
        recipient: Account,
        item_name: String,
        item_type: String,
        rarity: String,
        attack_power: UInt64,
        defense_power: UInt64,
        special_effect: String
    ) -> UInt64:
        """Create a new game item as an ASA"""
        assert Txn.sender == self.game_master.value, "Only game master can create items"
        assert self.is_registered[recipient], "Recipient must be registered player"
        
        # Create ASA for the item (simplified without complex metadata struct)
        item_unit_name = String("ALGITEM")
        item_asa = itxn.AssetConfig(
            asset_name=item_name,
            unit_name=item_unit_name,
            total=UInt64(1),  # Unique item
            decimals=UInt64(0),
            default_frozen=False,
            manager=Global.current_application_address,
            reserve=Global.current_application_address,
            freeze=Global.current_application_address,
            clawback=Global.current_application_address,
            fee=Global.min_txn_fee,  # Use minimum transaction fee
            # Store basic item info in note field
            note=op.concat(item_name.bytes, rarity.bytes)
        ).submit()
        
        # Note: Item is created but stays with the contract
        # Recipient needs to opt-in and then call claim_item to receive it
        
        self.total_items_created.value += UInt64(1)
        
        log(Bytes(b"Item created"))
        return item_asa.created_asset.id
    
    @abimethod()
    def recover_lost_item(
        self,
        original_item_id: Asset,
        recovery_quest_proof: Bytes,
        new_recipient: Account
    ) -> UInt64:
        """
        ON-DEMAND TOKENIZATION: Recover a lost game item
        This is the core feature for Task 6
        """
        assert self.is_registered[Txn.sender], "Only registered players can recover items"
        
        # Get original item metadata
        original_metadata_response = op.AssetParamsGet.asset_metadata_hash(original_item_id)
        assert original_metadata_response[0], "Original item not found"
        
        # Verify recovery quest completion (simplified - in real game, check quest system)
        assert recovery_quest_proof != Bytes(), "Must provide recovery quest proof"
        
        # Check recovery limits
        current_recovery_count = self.player_recovery_count[Txn.sender]
        assert current_recovery_count < self.max_recovery_per_item.value, "Recovery limit reached - max 3 recoveries per player"
        
        # Get original item name for new ASA
        original_name_response = op.AssetParamsGet.asset_name(original_item_id)
        assert original_name_response[0], "Cannot get original item name"
        original_name = original_name_response[1]
        
        # Create NEW ASA with same properties but marked as recovered
        recovered_name = String("RECOVERED_ITEM")
        recovery_note = op.concat(Bytes(b"RECOVERED_ITEM_"), recovery_quest_proof)
        recovered_item_asa = itxn.AssetConfig(
            asset_name=recovered_name,
            unit_name=String("ALGRECOV"),
            total=UInt64(1),
            decimals=UInt64(0),
            default_frozen=False,
            manager=Global.current_application_address,
            reserve=Global.current_application_address,
            freeze=Global.current_application_address,
            clawback=Global.current_application_address,
            fee=Global.min_txn_fee,  # Use minimum transaction fee
            note=recovery_note
        ).submit()
        
        # Note: Recovered item stays with the contract
        # New recipient needs to opt-in and then call claim_item to receive it
        
        # Update player recovery count
        self.player_recovery_count[Txn.sender] = current_recovery_count + UInt64(1)
        
        log(Bytes(b"Item recovered"))
        return recovered_item_asa.created_asset.id
    
    @abimethod()
    def seasonal_event_reissue(
        self,
        event_name: String,
        participation_proof: Bytes,
        recipient: Account
    ) -> UInt64:
        """
        ON-DEMAND TOKENIZATION: Reissue seasonal event items
        Allows players to earn previous season items in new events
        """
        assert self.is_registered[Txn.sender], "Only registered players can participate"
        assert participation_proof != Bytes(), "Must provide participation proof"
        
        # Create seasonal item based on event
        seasonal_item_name = String("SEASONAL_ITEM")
        seasonal_note = op.concat(Bytes(b"SEASONAL_"), participation_proof)
        
        seasonal_asa = itxn.AssetConfig(
            asset_name=seasonal_item_name,
            unit_name=String("ALGSEASN"),
            total=UInt64(1),
            decimals=UInt64(0),
            default_frozen=False,
            manager=Global.current_application_address,
            reserve=Global.current_application_address,
            fee=Global.min_txn_fee,  # Use minimum transaction fee
            note=seasonal_note
        ).submit()
        
        # Note: Seasonal item stays with the contract
        # Recipient needs to opt-in and then call claim_item to receive it
        
        log(Bytes(b"Seasonal item issued"))
        return seasonal_asa.created_asset.id
    
    @abimethod()
    def craft_items(
        self,
        material_1: Asset,
        material_2: Asset,
        recipe_id: UInt64
    ) -> UInt64:
        """
        Craft new items by combining existing ones
        Demonstrates atomic transactions
        """
        assert self.is_registered[Txn.sender], "Only registered players can craft"
        
        # Verify player owns both materials (simplified check)
        # In full implementation, verify asset holdings
        
        # Create crafted item based on recipe
        crafted_item_name = String("CRAFTED_ITEM")
        
        crafted_asa = itxn.AssetConfig(
            asset_name=crafted_item_name,
            unit_name=String("ALGCRAFT"),
            total=UInt64(1),
            decimals=UInt64(0),
            default_frozen=False,
            manager=Global.current_application_address,
            fee=Global.min_txn_fee,  # Use minimum transaction fee
            note=Bytes(b"CRAFTED_ITEM")
        ).submit()
        
        # Note: Crafted item stays with the contract
        # Player needs to opt-in and then call claim_item to receive it
        # Note: In full implementation, would destroy/transfer material ASAs here
        
        log(Bytes(b"Item crafted"))
        return crafted_asa.created_asset.id
    
    @abimethod(readonly=True)
    def get_player_stats(self, player: Account) -> tuple[UInt64, UInt64, UInt64]:
        """Get player statistics"""
        assert self.is_registered[player], "Player not registered"
        return (
            self.player_level[player],
            self.player_experience[player], 
            self.player_recovery_count[player]
        )
    
    @abimethod()
    def advance_season(self) -> UInt64:
        """Advance to next season (only game master)"""
        assert Txn.sender == self.game_master.value, "Only game master can advance season"
        self.current_season.value += 1
        log(Bytes(b"Season advanced"))
        return self.current_season.value
    
    @abimethod(readonly=True)
    def get_game_info(self) -> tuple[UInt64, UInt64, UInt64]:
        """Get current game information"""
        return (
            self.total_players.value,
            self.total_items_created.value,
            self.current_season.value
        )
    
    @abimethod()
    def claim_item(self, item_id: Asset) -> String:
        """
        Claim an item that was created for the player.
        Player must have opted-in to the asset before calling this.
        """
        assert self.is_registered[Txn.sender], "Only registered players can claim items"
        
        # Verify the asset exists
        manager_response = op.AssetParamsGet.asset_manager(item_id)
        assert manager_response[0], "Asset not found"
        # Note: In production, should verify asset is managed by this contract
        
        # Transfer item to the player
        itxn.AssetTransfer(
            asset_receiver=Txn.sender,
            asset_amount=UInt64(1),
            xfer_asset=item_id,
            fee=Global.min_txn_fee
        ).submit()
        
        log(Bytes(b"Item claimed"))
        return String("Item successfully claimed!")
    
    @abimethod(readonly=True)
    def get_recovery_status(self, player: Account) -> tuple[UInt64, UInt64]:
        """Get player's current recovery count and max allowed recoveries"""
        assert self.is_registered[player], "Player not registered"
        return self.player_recovery_count[player], self.max_recovery_per_item.value
