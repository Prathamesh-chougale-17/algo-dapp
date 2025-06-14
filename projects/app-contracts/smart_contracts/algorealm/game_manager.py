from algopy import ARC4Contract, String, UInt64, Bytes, Account, Asset, GlobalState, LocalState, Txn, Global, log, op
from algopy.arc4 import abimethod, Struct, DynamicArray, StaticArray, Address, UInt32, Bool
from algopy import itxn


class PlayerStats(Struct):
    """Player statistics structure"""
    level: UInt64
    experience: UInt64
    health: UInt64
    mana: UInt64
    attack: UInt64
    defense: UInt64
    last_quest_time: UInt64
    recovery_count: UInt64  # For on-demand tokenization limits


class ItemMetadata(Struct):
    """Game item metadata structure"""
    name: String
    item_type: String  # "weapon", "armor", "consumable", "badge"
    rarity: String     # "common", "rare", "epic", "legendary"
    attack_power: UInt64
    defense_power: UInt64
    special_effect: String
    is_recovered: Bool  # True if this is a recovered item
    original_creation_time: UInt64
    recovery_count: UInt64


class AlgoRealmGameManager(ARC4Contract):
    """
    Main game manager contract for AlgoRealm
    Handles player registration, item management, and on-demand tokenization
    """
    
    def __init__(self) -> None:
        # Global game state
        self.total_players = GlobalState(UInt64(0))
        self.total_items_created = GlobalState(UInt64(0))
        self.game_master = GlobalState(Account(Global.creator_address))
        self.current_season = GlobalState(UInt64(1))
        self.max_recovery_per_item = GlobalState(UInt64(3))  # Max 3 recoveries per item
        
        # Player local state
        self.player_stats = LocalState(PlayerStats)
        self.is_registered = LocalState(Bool)
    
    @abimethod()
    def register_player(self, player_name: String) -> String:
        """Register a new player in the game"""
        assert not self.is_registered[Txn.sender], "Player already registered"
        
        # Initialize player stats
        initial_stats = PlayerStats(
            level=UInt64(1),
            experience=UInt64(0),
            health=UInt64(100),
            mana=UInt64(50),
            attack=UInt64(10),
            defense=UInt64(5),
            last_quest_time=UInt64(0),
            recovery_count=UInt64(0)
        )
        
        self.player_stats[Txn.sender] = initial_stats
        self.is_registered[Txn.sender] = Bool(True)
        self.total_players.value += 1
        
        log(f"Player {player_name} registered successfully!")
        return f"Welcome to AlgoRealm, {player_name}!"
    
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
        
        # Create item metadata
        item_metadata = ItemMetadata(
            name=item_name,
            item_type=item_type,
            rarity=rarity,
            attack_power=attack_power,
            defense_power=defense_power,
            special_effect=special_effect,
            is_recovered=Bool(False),
            original_creation_time=Global.latest_timestamp,
            recovery_count=UInt64(0)
        )
        
        # Create ASA for the item
        item_asa = itxn.AssetConfig(
            asset_name=item_name,
            unit_name=f"ALG{item_type.upper()}",
            total=UInt64(1),  # Unique item
            decimals=UInt64(0),
            default_frozen=False,
            manager=Global.current_application_address,
            reserve=Global.current_application_address,
            freeze=Global.current_application_address,
            clawback=Global.current_application_address,
            # Store metadata in note field (in real implementation, use IPFS)
            note=item_metadata.bytes
        ).submit()
        
        # Transfer item to recipient
        itxn.AssetTransfer(
            asset_receiver=recipient,
            asset_amount=UInt64(1),
            xfer_asset=item_asa.created_asset.id
        ).submit()
        
        self.total_items_created.value += 1
        
        log(f"Created {rarity} {item_name} for player")
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
        assert len(recovery_quest_proof) > 0, "Must provide recovery quest proof"
        
        # Check recovery limits
        player_stats = self.player_stats[Txn.sender]
        assert player_stats.recovery_count < self.max_recovery_per_item.value, "Recovery limit reached"
        
        # Get original item name for new ASA
        original_name_response = op.AssetParamsGet.asset_name(original_item_id)
        assert original_name_response[0], "Cannot get original item name"
        original_name = original_name_response[1]
        
        # Create NEW ASA with same properties but marked as recovered
        recovered_item_asa = itxn.AssetConfig(
            asset_name=f"RECOVERED_{original_name}",
            unit_name="ALGRECOV",
            total=UInt64(1),
            decimals=UInt64(0),
            default_frozen=False,
            manager=Global.current_application_address,
            reserve=Global.current_application_address,
            freeze=Global.current_application_address,
            clawback=Global.current_application_address,
            note=Bytes(b"RECOVERED_ITEM_" + recovery_quest_proof)
        ).submit()
        
        # Transfer recovered item to new recipient
        itxn.AssetTransfer(
            asset_receiver=new_recipient,
            asset_amount=UInt64(1),
            xfer_asset=recovered_item_asa.created_asset.id
        ).submit()
        
        # Update player recovery count
        player_stats.recovery_count += 1
        self.player_stats[Txn.sender] = player_stats
        
        log(f"Item recovered successfully! New ASA ID: {recovered_item_asa.created_asset.id}")
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
        assert len(participation_proof) > 0, "Must provide participation proof"
        
        # Create seasonal item based on event
        seasonal_item_name = f"{event_name}_Season_{self.current_season.value}"
        
        seasonal_asa = itxn.AssetConfig(
            asset_name=seasonal_item_name,
            unit_name="ALGSEASN",
            total=UInt64(1),
            decimals=UInt64(0),
            default_frozen=False,
            manager=Global.current_application_address,
            reserve=Global.current_application_address,
            note=Bytes(b"SEASONAL_" + participation_proof)
        ).submit()
        
        # Transfer to recipient
        itxn.AssetTransfer(
            asset_receiver=recipient,
            asset_amount=UInt64(1),
            xfer_asset=seasonal_asa.created_asset.id
        ).submit()
        
        log(f"Seasonal item {seasonal_item_name} issued!")
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
        crafted_item_name = f"Crafted_Item_Recipe_{recipe_id}"
        
        crafted_asa = itxn.AssetConfig(
            asset_name=crafted_item_name,
            unit_name="ALGCRAFT",
            total=UInt64(1),
            decimals=UInt64(0),
            default_frozen=False,
            manager=Global.current_application_address,
            note=Bytes(b"CRAFTED_ITEM")
        ).submit()
        
        # Transfer crafted item to player
        itxn.AssetTransfer(
            asset_receiver=Txn.sender,
            asset_amount=UInt64(1),
            xfer_asset=crafted_asa.created_asset.id
        ).submit()
        
        # Note: In full implementation, would destroy/transfer material ASAs here
        
        log(f"Item crafted successfully!")
        return crafted_asa.created_asset.id
    
    @abimethod(readonly=True)
    def get_player_stats(self, player: Account) -> PlayerStats:
        """Get player statistics"""
        assert self.is_registered[player], "Player not registered"
        return self.player_stats[player]
    
    @abimethod()
    def advance_season(self) -> UInt64:
        """Advance to next season (only game master)"""
        assert Txn.sender == self.game_master.value, "Only game master can advance season"
        self.current_season.value += 1
        log(f"Advanced to season {self.current_season.value}")
        return self.current_season.value
    
    @abimethod(readonly=True)
    def get_game_info(self) -> tuple[UInt64, UInt64, UInt64]:
        """Get current game information"""
        return (
            self.total_players.value,
            self.total_items_created.value,
            self.current_season.value
        )
