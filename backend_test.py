import requests
import sys
import json
from datetime import datetime

class DentalImplantAPITester:
    def __init__(self, base_url="https://implantflow-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_case_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, params=params)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, params=params)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"Response: {response.text}")
                except:
                    pass

            return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API", "GET", "", 200)

    def test_create_case(self):
        """Test case creation"""
        case_data = {
            "caseName": "Test Upper Molar Implant",
            "toothNumber": "14",
            "optionalAge": 45,
            "optionalSex": "female"
        }
        success, response = self.run_test("Create Case", "POST", "cases", 200, case_data)
        if success and 'id' in response:
            self.created_case_id = response['id']
            print(f"Created case with ID: {self.created_case_id}")
        return success

    def test_get_all_cases(self):
        """Test getting all cases"""
        return self.run_test("Get All Cases", "GET", "cases", 200)

    def test_get_case_by_id(self):
        """Test getting case by ID"""
        if not self.created_case_id:
            print("❌ No case ID available for testing")
            return False
        return self.run_test("Get Case by ID", "GET", f"cases/{self.created_case_id}", 200)

    def test_update_case(self):
        """Test updating case"""
        if not self.created_case_id:
            print("❌ No case ID available for testing")
            return False
        
        update_data = {
            "planningData": {
                "boneAvailability": "adequate",
                "boneHeight": ">10mm",
                "boneWidth": ">6mm",
                "estheticZone": "moderate",
                "softTissueBiotype": "thick"
            }
        }
        return self.run_test("Update Case", "PUT", f"cases/{self.created_case_id}", 200, update_data)

    def test_analyze_case(self):
        """Test risk analysis"""
        if not self.created_case_id:
            print("❌ No case ID available for testing")
            return False
        return self.run_test("Analyze Case", "POST", f"cases/{self.created_case_id}/analyze", 200)

    def test_update_checklist(self):
        """Test checklist update"""
        if not self.created_case_id:
            print("❌ No case ID available for testing")
            return False
        
        checklist_data = {
            "phase": "pre_treatment",
            "items": [
                {
                    "id": "test-item-1",
                    "text": "CBCT scan reviewed",
                    "completed": True,
                    "isCustom": False,
                    "completedAt": datetime.now().isoformat()
                }
            ]
        }
        return self.run_test("Update Checklist", "PUT", f"cases/{self.created_case_id}/checklists", 200, checklist_data)

    def test_add_checklist_item(self):
        """Test adding custom checklist item"""
        if not self.created_case_id:
            print("❌ No case ID available for testing")
            return False
        
        item_data = {
            "text": "Custom test item",
            "completed": False
        }
        return self.run_test("Add Checklist Item", "POST", f"cases/{self.created_case_id}/checklists/pre_treatment/item", 200, item_data)

    def test_update_feedback(self):
        """Test learning loop feedback"""
        if not self.created_case_id:
            print("❌ No case ID available for testing")
            return False
        
        feedback_data = {
            "whatWasUnexpected": "Bone quality was softer than expected",
            "whatToDoubleCheckNextTime": "Always verify bone density with CBCT",
            "customChecklistSuggestions": ["Check sinus proximity", "Verify nerve location"]
        }
        return self.run_test("Update Feedback", "PUT", f"cases/{self.created_case_id}/feedback", 200, feedback_data)

    def test_get_learning_suggestions(self):
        """Test getting learning suggestions"""
        return self.run_test("Get Learning Suggestions", "GET", "learning/suggestions", 200)

    def test_update_status(self):
        """Test status update"""
        if not self.created_case_id:
            print("❌ No case ID available for testing")
            return False
        return self.run_test("Update Status", "PUT", f"cases/{self.created_case_id}/status", 200, params={"status": "in_progress"})

    def test_add_attachment(self):
        """Test adding attachment"""
        if not self.created_case_id:
            print("❌ No case ID available for testing")
            return False
        
        attachment_data = {
            "type": "images",
            "url": "https://example.com/test-image.jpg"
        }
        return self.run_test("Add Attachment", "POST", f"cases/{self.created_case_id}/attachments", 200, attachment_data)

    def test_delete_case(self):
        """Test case deletion"""
        if not self.created_case_id:
            print("❌ No case ID available for testing")
            return False
        return self.run_test("Delete Case", "DELETE", f"cases/{self.created_case_id}", 200)

def main():
    print("🦷 Starting Dental Implant Planning API Tests")
    print("=" * 50)
    
    tester = DentalImplantAPITester()
    
    # Test sequence
    tests = [
        tester.test_root_endpoint,
        tester.test_create_case,
        tester.test_get_all_cases,
        tester.test_get_case_by_id,
        tester.test_update_case,
        tester.test_analyze_case,
        tester.test_update_checklist,
        tester.test_add_checklist_item,
        tester.test_update_feedback,
        tester.test_get_learning_suggestions,
        tester.test_update_status,
        tester.test_add_attachment,
        tester.test_delete_case,
    ]
    
    for test in tests:
        test()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Tests Results: {tester.tests_passed}/{tester.tests_run} passed")
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())