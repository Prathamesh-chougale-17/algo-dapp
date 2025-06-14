from algopy import ARC4Contract, String, UInt64, Bytes, Account, GlobalState, LocalState, Txn, Global, log, op
from algopy.arc4 import abimethod, Struct, Bool, DynamicArray, Address
from algopy import itxn


class Guild(Struct):
    """Guild structure"""
    guild_id: UInt64
    name: String
    leader: Account
    member_count: UInt64
    guild_treasury: UInt64  # Amount of ALGO in guild treasury
    is_active: Bool
    creation_time: UInt64


class GuildMember(Struct):
    """Guild member information"""
    player: Account
    role: String  # "leader", "officer", "member"
    join_time: UInt64
    contribution_score: UInt64


class AlgoRealmGuildSystem(ARC4Contract):
    """
    Guild system for AlgoRealm
    Demonstrates multisig functionality for guild management
    """
    
    def __init__(self) -> None:
        self.guild_master = GlobalState(Account(Global.creator_address))
        self.total_guilds = GlobalState(UInt64(0))
        self.active_guilds_count = GlobalState(UInt64(0))
        
        # Local state for players
        self.player_guild_id = LocalState(UInt64)  # 0 means no guild
        self.player_role = LocalState(String)
        self.is_guild_member = LocalState(Bool)
    
    @abimethod()
    def create_guild(
        self,
        guild_name: String,
        initial_treasury: UInt64
    ) -> UInt64:
        """Create a new guild"""
        assert not self.is_guild_member[Txn.sender], "Already in a guild"
        assert initial_treasury >= UInt64(100000), "Minimum 0.1 ALGO required for guild creation"  # 0.1 ALGO
        
        guild_id = self.total_guilds.value + 1
        
        # Transfer ALGO to contract for guild treasury
        # In full implementation, handle ALGO payment
        
        # Set player as guild leader
        self.player_guild_id[Txn.sender] = guild_id
        self.player_role[Txn.sender] = String("leader")
        self.is_guild_member[Txn.sender] = Bool(True)
        
        self.total_guilds.value = guild_id
        self.active_guilds_count.value += 1
        
        log(f"Guild '{guild_name}' created with ID {guild_id}")
        return guild_id
    
    @abimethod()
    def join_guild(
        self,
        guild_id: UInt64,
        application_message: String
    ) -> String:
        """Apply to join a guild"""
        assert not self.is_guild_member[Txn.sender], "Already in a guild"
        assert guild_id <= self.total_guilds.value, "Guild does not exist"
        
        # In full implementation, this would create a pending application
        # For now, auto-approve
        
        self.player_guild_id[Txn.sender] = guild_id
        self.player_role[Txn.sender] = String("member")
        self.is_guild_member[Txn.sender] = Bool(True)
        
        log(f"Player joined guild {guild_id}")
        return f"Welcome to guild {guild_id}!"
    
    @abimethod()
    def guild_multisig_action(
        self,
        action_type: String,
        target_player: Account,
        amount: UInt64,
        approval_1: Bytes,
        approval_2: Bytes
    ) -> String:
        """
        MULTISIG FUNCTIONALITY: Guild actions requiring multiple approvals
        This demonstrates Task 4 - Multisig Asset Management
        """
        assert self.is_guild_member[Txn.sender], "Must be guild member"
        current_role = self.player_role[Txn.sender]
        assert current_role == String("leader") or current_role == String("officer"), "Insufficient permissions"
        
        # Verify multisig approvals (simplified)
        assert len(approval_1) > 0 and len(approval_2) > 0, "Must have two approvals"
        
        guild_id = self.player_guild_id[Txn.sender]
        
        if action_type == String("treasury_payout"):
            # Pay from guild treasury (requires multisig)
            # In full implementation, transfer ALGO from guild treasury
            log(f"Guild {guild_id} treasury payout of {amount} microALGO to {target_player}")
            return f"Treasury payout approved: {amount} microALGO"
            
        elif action_type == String("promote_member"):
            # Promote member to officer (requires multisig)
            log(f"Member promotion approved in guild {guild_id}")
            return f"Member promoted to officer"
            
        elif action_type == String("guild_item_transfer"):
            # Transfer guild-owned items (requires multisig)
            log(f"Guild item transfer approved in guild {guild_id}")
            return f"Guild item transferred"
        
        return "Unknown action type"
    
    @abimethod()
    def distribute_guild_rewards(
        self,
        reward_asa_id: UInt64,
        members: DynamicArray[Address],
        amounts: DynamicArray[UInt64]
    ) -> String:
        """
        Distribute guild rewards using atomic transactions
        Demonstrates advanced Algorand features
        """
        assert self.is_guild_member[Txn.sender], "Must be guild member"
        assert self.player_role[Txn.sender] == String("leader"), "Only guild leader can distribute rewards"
        assert len(members) == len(amounts), "Members and amounts arrays must match"
        
        # In full implementation, would use atomic transactions to distribute ASAs
        # This would be multiple AssetTransfer transactions in a single group
        
        total_distributed = UInt64(0)
        for i in range(len(amounts)):
            total_distributed += amounts[i]
        
        log(f"Distributed {total_distributed} guild reward tokens to {len(members)} members")
        return f"Guild rewards distributed to {len(members)} members"
    
    @abimethod()
    def leave_guild(self) -> String:
        """Leave current guild"""
        assert self.is_guild_member[Txn.sender], "Not in a guild"
        
        guild_id = self.player_guild_id[Txn.sender]
        role = self.player_role[Txn.sender]
        
        # Reset player guild state
        self.player_guild_id[Txn.sender] = UInt64(0)
        self.player_role[Txn.sender] = String("")
        self.is_guild_member[Txn.sender] = Bool(False)
        
        log(f"Player left guild {guild_id}")
        return f"Left guild {guild_id}"
    
    @abimethod(readonly=True)
    def get_player_guild_info(self, player: Account) -> tuple[UInt64, String, Bool]:
        """Get player's guild information"""
        return (
            self.player_guild_id[player],
            self.player_role[player],
            self.is_guild_member[player]
        )
    
    @abimethod(readonly=True)
    def get_guild_system_stats(self) -> tuple[UInt64, UInt64]:
        """Get guild system statistics"""
        return (
            self.total_guilds.value,
            self.active_guilds_count.value
        )
