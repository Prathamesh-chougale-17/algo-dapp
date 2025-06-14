from algopy import ARC4Contract, String, UInt64, Bytes, Account, GlobalState, LocalState, Txn, Global, log, op
from algopy.arc4 import abimethod, Struct, Bool, DynamicArray
from algopy import itxn


class Quest(Struct):
    """Quest structure"""
    quest_id: UInt64
    name: String
    description: String
    reward_item_type: String
    reward_rarity: String
    experience_reward: UInt64
    is_active: Bool
    completion_count: UInt64


class QuestProgress(Struct):
    """Player's quest progress"""
    quest_id: UInt64
    progress: UInt64
    is_completed: Bool
    completion_time: UInt64


class AlgoRealmQuestSystem(ARC4Contract):
    """
    Quest system for AlgoRealm
    Handles quest creation, completion, and rewards
    """
    
    def __init__(self) -> None:
        self.quest_master = GlobalState(Account(Global.creator_address))
        self.total_quests = GlobalState(UInt64(0))
        self.active_quests_count = GlobalState(UInt64(0))
        
        # Local state for players
        self.completed_quests_count = LocalState(UInt64)
        self.total_experience_earned = LocalState(UInt64)
    
    @abimethod()
    def create_quest(
        self,
        name: String,
        description: String,
        reward_item_type: String,
        reward_rarity: String,
        experience_reward: UInt64
    ) -> UInt64:
        """Create a new quest (only quest master)"""
        assert Txn.sender == self.quest_master.value, "Only quest master can create quests"
        
        quest_id = self.total_quests.value + 1
        
        # Store quest data in global state (simplified)
        # In full implementation, use box storage for complex data
        
        self.total_quests.value = quest_id
        self.active_quests_count.value += 1
        
        log(f"Quest '{name}' created with ID {quest_id}")
        return quest_id
    
    @abimethod()
    def complete_quest(
        self,
        quest_id: UInt64,
        completion_proof: Bytes
    ) -> String:
        """
        Complete a quest and earn rewards
        This can be used as proof for item recovery
        """
        assert quest_id <= self.total_quests.value, "Quest does not exist"
        assert len(completion_proof) > 0, "Must provide completion proof"
        
        # Verify quest completion (simplified)
        # In real implementation, check specific quest requirements
        
        # Update player progress
        self.completed_quests_count[Txn.sender] += 1
        self.total_experience_earned[Txn.sender] += UInt64(100)  # Base reward
        
        log(f"Quest {quest_id} completed by player!")
        return f"Quest {quest_id} completed! Earned experience."
    
    @abimethod()
    def generate_recovery_proof(
        self,
        quest_id: UInt64
    ) -> Bytes:
        """
        Generate proof of quest completion for item recovery
        This is used in the main game contract's recover_lost_item function
        """
        assert self.completed_quests_count[Txn.sender] > 0, "Must complete at least one quest"
        
        # Create a simple proof (in real implementation, use cryptographic proof)
        proof = Bytes(b"RECOVERY_QUEST_") + op.itob(quest_id) + op.itob(Global.latest_timestamp)
        
        log("Recovery proof generated")
        return proof
    
    @abimethod(readonly=True)
    def get_player_quest_stats(self, player: Account) -> tuple[UInt64, UInt64]:
        """Get player's quest statistics"""
        return (
            self.completed_quests_count[player],
            self.total_experience_earned[player]
        )
    
    @abimethod(readonly=True)
    def get_quest_system_info(self) -> tuple[UInt64, UInt64]:
        """Get quest system information"""
        return (
            self.total_quests.value,
            self.active_quests_count.value
        )
