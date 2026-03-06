"""
Discussion API Integration Tests with Authentication
Tests the critical security and performance fixes:
1. Delete authorization - only Clinician role can delete
2. Cursor-based pagination
3. Incremental polling via discussion-events
4. Send message with mentions
5. Add/toggle reactions
6. Case member access control
"""

import pytest
import requests
import os
import asyncio
from datetime import datetime, timezone
import uuid

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# MongoDB connection for setup
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load backend env
load_dotenv('/app/backend/.env')

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')


class TestDiscussionIntegration:
    """Integration tests requiring database setup"""
    
    @pytest.fixture(scope="class")
    def event_loop(self):
        loop = asyncio.new_event_loop()
        yield loop
        loop.close()
    
    @pytest.fixture(scope="class")
    def db_client(self):
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        yield db
        client.close()
    
    @pytest.fixture(scope="class")
    def test_ids(self):
        """Generate unique test IDs"""
        return {
            "clinician_id": f"TEST_clinician_{uuid.uuid4()}",
            "implantologist_id": f"TEST_implantologist_{uuid.uuid4()}",
            "case_id": f"TEST_case_{uuid.uuid4()}",
            "message_id": f"TEST_message_{uuid.uuid4()}"
        }
    
    @pytest.fixture(scope="class")
    async def setup_test_data(self, db_client, test_ids):
        """Setup test users, team members, and cases"""
        db = db_client
        
        # Create test clinician user
        clinician = {
            "id": test_ids["clinician_id"],
            "name": "TEST Clinician Dr. Smith",
            "mobile": "+911111111111",
            "onboarding_stage": "COMPLETED",
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(clinician)
        
        # Create test implantologist team member
        implantologist = {
            "id": test_ids["implantologist_id"],
            "name": "TEST Implantologist Dr. Jones",
            "role": "Implantologist",
            "mobile_number": "+912222222222",
            "clinic_id": test_ids["clinician_id"],
            "created_at": datetime.now(timezone.utc)
        }
        await db.team_members.insert_one(implantologist)
        
        # Create test case with clinician as owner
        case = {
            "id": test_ids["case_id"],
            "caseName": "TEST Discussion Case",
            "toothNumber": "8",
            "created_by_clinician_id": test_ids["clinician_id"],
            "assigned_implantologist_id": test_ids["implantologist_id"],
            "assigned_prosthodontist_id": None,
            "assigned_assistant_id": None,
            "clinic_id": test_ids["clinician_id"],
            "status": "planning",
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        await db.cases.insert_one(case)
        
        yield test_ids
        
        # Cleanup after tests
        await db.users.delete_many({"id": {"$regex": "^TEST_"}})
        await db.team_members.delete_many({"id": {"$regex": "^TEST_"}})
        await db.cases.delete_many({"id": {"$regex": "^TEST_"}})
        await db.discussion_messages.delete_many({"case_id": {"$regex": "^TEST_"}})
        await db.message_reactions.delete_many({"message_id": {"$regex": "^TEST_"}})
    
    @pytest.fixture(scope="class")
    def auth_token_clinician(self, test_ids):
        """Generate JWT token for clinician (mock)"""
        # In real scenario, we'd use the OTP flow, but for testing we create token directly
        from auth.security import create_access_token
        
        token = create_access_token({
            "sub": "+911111111111",
            "userId": test_ids["clinician_id"],
            "clinicianName": "TEST Clinician Dr. Smith",
            "type": "access"
        })
        return token
    
    @pytest.fixture(scope="class")
    def auth_token_implantologist(self, test_ids):
        """Generate JWT token for implantologist"""
        from auth.security import create_access_token
        
        token = create_access_token({
            "sub": "+912222222222",
            "userId": test_ids["implantologist_id"],
            "clinicianName": "TEST Implantologist Dr. Jones",
            "type": "access"
        })
        return token
    
    @pytest.fixture(scope="class")
    def clinician_headers(self, auth_token_clinician):
        return {
            "Authorization": f"Bearer {auth_token_clinician}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def implantologist_headers(self, auth_token_implantologist):
        return {
            "Authorization": f"Bearer {auth_token_implantologist}",
            "Content-Type": "application/json"
        }


class TestDiscussionService:
    """Direct tests on DiscussionService methods"""
    
    @pytest.fixture
    def db_client(self):
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        yield db
        client.close()
    
    @pytest.mark.asyncio
    async def test_get_user_role_clinician(self, db_client):
        """Test get_user_role returns Clinician for case creator"""
        from services.discussion_service import DiscussionService
        
        # Create test data
        clinician_id = f"TEST_cli_{uuid.uuid4()}"
        case_id = f"TEST_case_{uuid.uuid4()}"
        
        # Insert test user
        await db_client.users.insert_one({
            "id": clinician_id,
            "name": "Test Clinician",
            "mobile": "+911234567890"
        })
        
        # Insert test case
        case = {
            "id": case_id,
            "caseName": "Test Case",
            "created_by_clinician_id": clinician_id,
            "assigned_implantologist_id": None
        }
        await db_client.cases.insert_one(case)
        
        service = DiscussionService(db_client)
        
        # Test get_user_role
        role = await service.get_user_role(case, clinician_id)
        assert role == "Clinician", f"Expected 'Clinician' but got '{role}'"
        
        # Cleanup
        await db_client.users.delete_one({"id": clinician_id})
        await db_client.cases.delete_one({"id": case_id})
        
        print("✓ get_user_role returns 'Clinician' for case creator")
    
    @pytest.mark.asyncio
    async def test_get_user_role_implantologist(self, db_client):
        """Test get_user_role returns correct role for team member"""
        from services.discussion_service import DiscussionService
        
        # Create test data
        clinician_id = f"TEST_cli_{uuid.uuid4()}"
        implantologist_id = f"TEST_imp_{uuid.uuid4()}"
        case_id = f"TEST_case_{uuid.uuid4()}"
        
        # Insert test team member
        await db_client.team_members.insert_one({
            "id": implantologist_id,
            "name": "Test Implantologist",
            "role": "Implantologist",
            "clinic_id": clinician_id
        })
        
        # Insert test case
        case = {
            "id": case_id,
            "caseName": "Test Case",
            "created_by_clinician_id": clinician_id,
            "assigned_implantologist_id": implantologist_id
        }
        await db_client.cases.insert_one(case)
        
        service = DiscussionService(db_client)
        
        # Test get_user_role for implantologist
        role = await service.get_user_role(case, implantologist_id)
        assert role == "Implantologist", f"Expected 'Implantologist' but got '{role}'"
        
        # Cleanup
        await db_client.team_members.delete_one({"id": implantologist_id})
        await db_client.cases.delete_one({"id": case_id})
        
        print("✓ get_user_role returns 'Implantologist' for team member")
    
    @pytest.mark.asyncio
    async def test_list_messages_with_cursor(self, db_client):
        """Test list_case_messages with cursor-based pagination"""
        from services.discussion_service import DiscussionService
        
        case_id = f"TEST_case_{uuid.uuid4()}"
        
        # Create 5 test messages with different timestamps
        for i in range(5):
            await db_client.discussion_messages.insert_one({
                "id": f"TEST_msg_{uuid.uuid4()}",
                "case_id": case_id,
                "sender_id": "test_sender",
                "sender_name": "Test User",
                "sender_role": "clinician",
                "message": f"Test message {i}",
                "mentions": [],
                "parent_message_id": None,
                "created_at": datetime.now(timezone.utc),
                "deleted": False
            })
        
        service = DiscussionService(db_client)
        
        # Get first 3 messages
        messages, has_more = await service.list_case_messages(case_id, limit=3)
        
        assert len(messages) == 3, f"Expected 3 messages, got {len(messages)}"
        assert has_more == True, "Expected has_more=True with 5 messages and limit=3"
        
        # Cleanup
        await db_client.discussion_messages.delete_many({"case_id": case_id})
        
        print("✓ Cursor-based pagination works correctly")
    
    @pytest.mark.asyncio
    async def test_list_messages_after_incremental(self, db_client):
        """Test list_case_messages_after for incremental polling"""
        from services.discussion_service import DiscussionService
        import time
        
        case_id = f"TEST_case_{uuid.uuid4()}"
        
        # Create initial message
        initial_time = datetime.now(timezone.utc)
        await db_client.discussion_messages.insert_one({
            "id": f"TEST_msg_{uuid.uuid4()}",
            "case_id": case_id,
            "sender_id": "test_sender",
            "sender_name": "Test User",
            "sender_role": "clinician",
            "message": "Initial message",
            "mentions": [],
            "parent_message_id": None,
            "created_at": initial_time,
            "deleted": False
        })
        
        # Small delay
        time.sleep(0.1)
        
        # Create new messages after cursor
        new_time = datetime.now(timezone.utc)
        for i in range(2):
            await db_client.discussion_messages.insert_one({
                "id": f"TEST_msg_{uuid.uuid4()}",
                "case_id": case_id,
                "sender_id": "test_sender",
                "sender_name": "Test User",
                "sender_role": "clinician",
                "message": f"New message {i}",
                "mentions": [],
                "parent_message_id": None,
                "created_at": datetime.now(timezone.utc),
                "deleted": False
            })
        
        service = DiscussionService(db_client)
        
        # Fetch messages after initial_time
        messages, _ = await service.list_case_messages_after(
            case_id, 
            after_cursor=initial_time.isoformat()
        )
        
        assert len(messages) == 2, f"Expected 2 new messages, got {len(messages)}"
        
        # Cleanup
        await db_client.discussion_messages.delete_many({"case_id": case_id})
        
        print("✓ Incremental polling (list_case_messages_after) works correctly")


class TestDeleteAuthorization:
    """CRITICAL: Test that only Clinician role can delete messages"""
    
    @pytest.fixture
    def db_client(self):
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        yield db
        client.close()
    
    @pytest.mark.asyncio
    async def test_clinician_can_delete_message(self, db_client):
        """Verify Clinician role can delete messages"""
        from services.discussion_service import DiscussionService
        from auth.security import create_access_token
        
        clinician_id = f"TEST_cli_{uuid.uuid4()}"
        case_id = f"TEST_case_{uuid.uuid4()}"
        message_id = f"TEST_msg_{uuid.uuid4()}"
        
        # Create test user (Clinician)
        await db_client.users.insert_one({
            "id": clinician_id,
            "name": "Test Clinician",
            "mobile": "+911234567890"
        })
        
        # Create test case with clinician as owner
        await db_client.cases.insert_one({
            "id": case_id,
            "caseName": "Test Case",
            "created_by_clinician_id": clinician_id,
            "assigned_implantologist_id": None,
            "assigned_prosthodontist_id": None,
            "assigned_assistant_id": None
        })
        
        # Create test message
        await db_client.discussion_messages.insert_one({
            "id": message_id,
            "case_id": case_id,
            "sender_id": clinician_id,
            "sender_name": "Test Clinician",
            "message": "Test message to delete",
            "deleted": False,
            "created_at": datetime.now(timezone.utc)
        })
        
        # Generate auth token for clinician
        token = create_access_token({
            "sub": "+911234567890",
            "userId": clinician_id,
            "type": "access"
        })
        
        # Call delete endpoint
        response = requests.delete(
            f"{BASE_URL}/api/messages/{message_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Clinician delete failed: {response.status_code} - {response.text}"
        
        # Verify message is soft deleted
        message = await db_client.discussion_messages.find_one({"id": message_id})
        assert message["deleted"] == True, "Message should be soft deleted"
        
        # Cleanup
        await db_client.users.delete_one({"id": clinician_id})
        await db_client.cases.delete_one({"id": case_id})
        await db_client.discussion_messages.delete_one({"id": message_id})
        
        print("✓ CRITICAL: Clinician can successfully delete messages")
    
    @pytest.mark.asyncio
    async def test_implantologist_cannot_delete_message(self, db_client):
        """CRITICAL: Verify Implantologist role CANNOT delete messages"""
        from services.discussion_service import DiscussionService
        from auth.security import create_access_token
        
        clinician_id = f"TEST_cli_{uuid.uuid4()}"
        implantologist_id = f"TEST_imp_{uuid.uuid4()}"
        case_id = f"TEST_case_{uuid.uuid4()}"
        message_id = f"TEST_msg_{uuid.uuid4()}"
        
        # Create test clinician user
        await db_client.users.insert_one({
            "id": clinician_id,
            "name": "Test Clinician",
            "mobile": "+911234567890"
        })
        
        # Create test implantologist team member
        await db_client.team_members.insert_one({
            "id": implantologist_id,
            "name": "Test Implantologist",
            "role": "Implantologist",
            "clinic_id": clinician_id
        })
        
        # Create test case
        await db_client.cases.insert_one({
            "id": case_id,
            "caseName": "Test Case",
            "created_by_clinician_id": clinician_id,
            "assigned_implantologist_id": implantologist_id,
            "assigned_prosthodontist_id": None,
            "assigned_assistant_id": None
        })
        
        # Create test message
        await db_client.discussion_messages.insert_one({
            "id": message_id,
            "case_id": case_id,
            "sender_id": implantologist_id,
            "sender_name": "Test Implantologist",
            "message": "Test message that should not be deletable",
            "deleted": False,
            "created_at": datetime.now(timezone.utc)
        })
        
        # Generate auth token for implantologist
        token = create_access_token({
            "sub": "+912222222222",
            "userId": implantologist_id,
            "type": "access"
        })
        
        # Try to delete message - should FAIL
        response = requests.delete(
            f"{BASE_URL}/api/messages/{message_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403, \
            f"SECURITY ISSUE: Implantologist should NOT be able to delete! Got {response.status_code}: {response.text}"
        
        # Verify error message mentions role restriction
        assert "Clinician" in response.text, \
            f"Error should mention Clinician role requirement: {response.text}"
        
        # Verify message is NOT deleted
        message = await db_client.discussion_messages.find_one({"id": message_id})
        assert message["deleted"] == False, "Message should NOT be deleted"
        
        # Cleanup
        await db_client.users.delete_one({"id": clinician_id})
        await db_client.team_members.delete_one({"id": implantologist_id})
        await db_client.cases.delete_one({"id": case_id})
        await db_client.discussion_messages.delete_one({"id": message_id})
        
        print("✓ CRITICAL SECURITY: Implantologist correctly CANNOT delete messages")


class TestSendMessageAndReactions:
    """Test sending messages and adding reactions"""
    
    @pytest.fixture
    def db_client(self):
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        yield db
        client.close()
    
    @pytest.mark.asyncio
    async def test_send_message_as_case_member(self, db_client):
        """Test sending a message as a case member"""
        from auth.security import create_access_token
        
        clinician_id = f"TEST_cli_{uuid.uuid4()}"
        case_id = f"TEST_case_{uuid.uuid4()}"
        unique_mobile = f"+91{uuid.uuid4().hex[:10]}"  # Unique mobile number
        
        # Create test user
        await db_client.users.insert_one({
            "id": clinician_id,
            "name": "Test Clinician",
            "mobile_number": unique_mobile
        })
        
        # Create test case
        await db_client.cases.insert_one({
            "id": case_id,
            "caseName": "Test Case",
            "created_by_clinician_id": clinician_id,
            "assigned_implantologist_id": None,
            "assigned_prosthodontist_id": None,
            "assigned_assistant_id": None
        })
        
        # Generate auth token
        token = create_access_token({
            "sub": "+911234567890",
            "userId": clinician_id,
            "type": "access"
        })
        
        # Send message
        response = requests.post(
            f"{BASE_URL}/api/cases/{case_id}/messages",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                "message": "Hello team! @everyone please review this case",
                "mentions": ["everyone"],
                "parent_message_id": None
            }
        )
        
        assert response.status_code == 201, f"Send message failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should include message id"
        assert data["message"] == "Hello team! @everyone please review this case"
        assert "everyone" in data["mentions"]
        
        # Cleanup
        await db_client.users.delete_one({"id": clinician_id})
        await db_client.cases.delete_one({"id": case_id})
        await db_client.discussion_messages.delete_many({"case_id": case_id})
        
        print("✓ Send message with mentions works correctly")
    
    @pytest.mark.asyncio
    async def test_add_reaction_to_message(self, db_client):
        """Test adding a reaction to a message"""
        from auth.security import create_access_token
        
        clinician_id = f"TEST_cli_{uuid.uuid4()}"
        case_id = f"TEST_case_{uuid.uuid4()}"
        message_id = f"TEST_msg_{uuid.uuid4()}"
        
        # Create test user
        await db_client.users.insert_one({
            "id": clinician_id,
            "name": "Test Clinician",
            "mobile": "+911234567890"
        })
        
        # Create test case
        await db_client.cases.insert_one({
            "id": case_id,
            "caseName": "Test Case",
            "created_by_clinician_id": clinician_id,
            "assigned_implantologist_id": None,
            "assigned_prosthodontist_id": None,
            "assigned_assistant_id": None
        })
        
        # Create test message
        await db_client.discussion_messages.insert_one({
            "id": message_id,
            "case_id": case_id,
            "sender_id": clinician_id,
            "sender_name": "Test Clinician",
            "message": "Test message",
            "mentions": [],
            "deleted": False,
            "created_at": datetime.now(timezone.utc)
        })
        
        # Generate auth token
        token = create_access_token({
            "sub": "+911234567890",
            "userId": clinician_id,
            "type": "access"
        })
        
        # Add reaction
        response = requests.post(
            f"{BASE_URL}/api/messages/{message_id}/reaction",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"reaction_type": "👍"}
        )
        
        assert response.status_code == 200, f"Add reaction failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "reactions" in data, "Response should include updated reactions"
        
        # Verify reaction was added
        reactions = await db_client.message_reactions.find({"message_id": message_id}).to_list(10)
        assert len(reactions) >= 1, "Reaction should be added to database"
        
        # Cleanup
        await db_client.users.delete_one({"id": clinician_id})
        await db_client.cases.delete_one({"id": case_id})
        await db_client.discussion_messages.delete_one({"id": message_id})
        await db_client.message_reactions.delete_many({"message_id": message_id})
        
        print("✓ Add reaction to message works correctly")
    
    @pytest.mark.asyncio
    async def test_non_member_cannot_access_discussion(self, db_client):
        """Test that non-case members cannot access discussion"""
        from auth.security import create_access_token
        
        clinician_id = f"TEST_cli_{uuid.uuid4()}"
        non_member_id = f"TEST_non_{uuid.uuid4()}"
        case_id = f"TEST_case_{uuid.uuid4()}"
        
        # Create test clinician user
        await db_client.users.insert_one({
            "id": clinician_id,
            "name": "Test Clinician",
            "mobile": "+911234567890"
        })
        
        # Create non-member user
        await db_client.users.insert_one({
            "id": non_member_id,
            "name": "Non Member",
            "mobile": "+913333333333"
        })
        
        # Create test case (non_member is NOT a member)
        await db_client.cases.insert_one({
            "id": case_id,
            "caseName": "Test Case",
            "created_by_clinician_id": clinician_id,
            "assigned_implantologist_id": None,
            "assigned_prosthodontist_id": None,
            "assigned_assistant_id": None
        })
        
        # Generate auth token for NON-MEMBER
        token = create_access_token({
            "sub": "+913333333333",
            "userId": non_member_id,
            "type": "access"
        })
        
        # Try to access discussion - should FAIL
        response = requests.get(
            f"{BASE_URL}/api/cases/{case_id}/messages",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 403, \
            f"Non-member should NOT be able to access discussion! Got {response.status_code}: {response.text}"
        
        # Cleanup
        await db_client.users.delete_many({"id": {"$in": [clinician_id, non_member_id]}})
        await db_client.cases.delete_one({"id": case_id})
        
        print("✓ Non-case member correctly CANNOT access discussion")


class TestPaginationAndPolling:
    """Test cursor-based pagination and incremental polling endpoints"""
    
    @pytest.fixture
    def db_client(self):
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        yield db
        client.close()
    
    @pytest.mark.asyncio
    async def test_messages_endpoint_returns_pagination_info(self, db_client):
        """Test that GET /messages returns pagination info"""
        from auth.security import create_access_token
        import time
        
        clinician_id = f"TEST_cli_{uuid.uuid4()}"
        case_id = f"TEST_case_{uuid.uuid4()}"
        
        # Create test user
        await db_client.users.insert_one({
            "id": clinician_id,
            "name": "Test Clinician",
            "mobile": "+911234567890"
        })
        
        # Create test case
        await db_client.cases.insert_one({
            "id": case_id,
            "caseName": "Test Case",
            "created_by_clinician_id": clinician_id,
            "assigned_implantologist_id": None,
            "assigned_prosthodontist_id": None,
            "assigned_assistant_id": None
        })
        
        # Create multiple messages
        for i in range(10):
            await db_client.discussion_messages.insert_one({
                "id": f"TEST_msg_{uuid.uuid4()}",
                "case_id": case_id,
                "sender_id": clinician_id,
                "sender_name": "Test Clinician",
                "sender_role": "clinician",
                "message": f"Test message {i}",
                "mentions": [],
                "parent_message_id": None,
                "deleted": False,
                "created_at": datetime.now(timezone.utc)
            })
            time.sleep(0.01)  # Small delay for distinct timestamps
        
        # Generate auth token
        token = create_access_token({
            "sub": "+911234567890",
            "userId": clinician_id,
            "type": "access"
        })
        
        # Get messages with limit
        response = requests.get(
            f"{BASE_URL}/api/cases/{case_id}/messages?limit=5",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Get messages failed: {response.status_code} - {response.text}"
        
        data = response.json()
        
        # Check response structure
        assert "messages" in data, "Response should include 'messages'"
        assert "pagination" in data, "Response should include 'pagination'"
        
        pagination = data["pagination"]
        assert "limit" in pagination, "Pagination should include 'limit'"
        assert "count" in pagination, "Pagination should include 'count'"
        assert "has_more" in pagination, "Pagination should include 'has_more'"
        assert "next_cursor" in pagination, "Pagination should include 'next_cursor'"
        
        assert pagination["count"] == 5, f"Expected 5 messages, got {pagination['count']}"
        assert pagination["has_more"] == True, "Should have more messages"
        assert pagination["next_cursor"] is not None, "next_cursor should be set"
        
        # Cleanup
        await db_client.users.delete_one({"id": clinician_id})
        await db_client.cases.delete_one({"id": case_id})
        await db_client.discussion_messages.delete_many({"case_id": case_id})
        
        print("✓ Messages endpoint returns proper pagination info")
    
    @pytest.mark.asyncio
    async def test_discussion_events_incremental_polling(self, db_client):
        """Test that discussion-events endpoint returns only new messages"""
        from auth.security import create_access_token
        import time
        
        clinician_id = f"TEST_cli_{uuid.uuid4()}"
        case_id = f"TEST_case_{uuid.uuid4()}"
        
        # Create test user
        await db_client.users.insert_one({
            "id": clinician_id,
            "name": "Test Clinician",
            "mobile": "+911234567890"
        })
        
        # Create test case
        await db_client.cases.insert_one({
            "id": case_id,
            "caseName": "Test Case",
            "created_by_clinician_id": clinician_id,
            "assigned_implantologist_id": None,
            "assigned_prosthodontist_id": None,
            "assigned_assistant_id": None
        })
        
        # Create initial message
        initial_time = datetime.now(timezone.utc)
        await db_client.discussion_messages.insert_one({
            "id": f"TEST_msg_{uuid.uuid4()}",
            "case_id": case_id,
            "sender_id": clinician_id,
            "sender_name": "Test Clinician",
            "sender_role": "clinician",
            "message": "Initial message",
            "mentions": [],
            "parent_message_id": None,
            "deleted": False,
            "created_at": initial_time
        })
        
        time.sleep(0.1)
        
        # Create new messages after initial
        for i in range(3):
            await db_client.discussion_messages.insert_one({
                "id": f"TEST_msg_{uuid.uuid4()}",
                "case_id": case_id,
                "sender_id": clinician_id,
                "sender_name": "Test Clinician",
                "sender_role": "clinician",
                "message": f"New message {i}",
                "mentions": [],
                "parent_message_id": None,
                "deleted": False,
                "created_at": datetime.now(timezone.utc)
            })
        
        # Generate auth token
        token = create_access_token({
            "sub": "+911234567890",
            "userId": clinician_id,
            "type": "access"
        })
        
        # Get events since initial_time
        response = requests.get(
            f"{BASE_URL}/api/cases/{case_id}/discussion-events?since={initial_time.isoformat()}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Get events failed: {response.status_code} - {response.text}"
        
        data = response.json()
        
        # Check response structure
        assert "messages" in data, "Response should include 'messages'"
        assert "cursor" in data, "Response should include 'cursor'"
        
        # Should only return new messages (not the initial one)
        assert len(data["messages"]) == 3, f"Expected 3 new messages, got {len(data['messages'])}"
        
        # Cleanup
        await db_client.users.delete_one({"id": clinician_id})
        await db_client.cases.delete_one({"id": case_id})
        await db_client.discussion_messages.delete_many({"case_id": case_id})
        
        print("✓ Discussion-events endpoint returns only new messages since cursor")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-x"])
