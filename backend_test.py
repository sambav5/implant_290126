import requests
import sys
import json
from datetime import datetime

class DentalImplantAPITester:
    def __init__(self, base_url="https://access-check-11.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_case_id = None
        self.clinical_depth_results = []

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

    # ============ CLINICAL DEPTH TOGGLE TESTS ============
    
    def test_clinical_depth_simple_case(self):
        """Test Clinical Depth Toggle - Simple Case Scenario"""
        print("\n🔬 Testing Clinical Depth Toggle - Simple Case")
        
        # Create case for simple scenario
        case_data = {
            "caseName": "Simple Posterior Implant",
            "toothNumber": "30",  # Posterior tooth
            "optionalAge": 35,
            "optionalSex": "male"
        }
        
        success, response = self.run_test("Create Simple Case", "POST", "cases", 200, case_data)
        if not success or 'id' not in response:
            return False
            
        case_id = response['id']
        
        # Update with simple case planning data
        planning_data = {
            "planningData": {
                "boneAvailability": "adequate",
                "estheticZone": "low",
                "smokingStatus": "never",
                "diabetesStatus": "none",
                "medications": []
            }
        }
        
        success, _ = self.run_test("Update Simple Case Planning", "PUT", f"cases/{case_id}", 200, planning_data)
        if not success:
            return False
        
        # Analyze case
        success, analysis = self.run_test("Analyze Simple Case", "POST", f"cases/{case_id}/analyze", 200)
        if not success:
            return False
            
        # Verify Simple case results
        result = self.verify_clinical_depth_response(analysis, "Simple", case_id)
        self.clinical_depth_results.append(("Simple Case", result, analysis))
        
        # Cleanup
        self.run_test("Delete Simple Case", "DELETE", f"cases/{case_id}", 200)
        return result

    def test_clinical_depth_moderate_case(self):
        """Test Clinical Depth Toggle - Moderate Case Scenario"""
        print("\n🔬 Testing Clinical Depth Toggle - Moderate Case")
        
        # Create case for moderate scenario
        case_data = {
            "caseName": "Moderate Esthetic Zone Implant",
            "toothNumber": "8",  # Esthetic zone
            "optionalAge": 42,
            "optionalSex": "female"
        }
        
        success, response = self.run_test("Create Moderate Case", "POST", "cases", 200, case_data)
        if not success or 'id' not in response:
            return False
            
        case_id = response['id']
        
        # Update with moderate case planning data
        planning_data = {
            "planningData": {
                "boneAvailability": "moderate",
                "estheticZone": "high",
                "softTissueBiotype": "thin",
                "smokingStatus": "former",
                "diabetesStatus": "none"
            }
        }
        
        success, _ = self.run_test("Update Moderate Case Planning", "PUT", f"cases/{case_id}", 200, planning_data)
        if not success:
            return False
        
        # Analyze case
        success, analysis = self.run_test("Analyze Moderate Case", "POST", f"cases/{case_id}/analyze", 200)
        if not success:
            return False
            
        # Verify Moderate case results
        result = self.verify_clinical_depth_response(analysis, "Moderate", case_id)
        self.clinical_depth_results.append(("Moderate Case", result, analysis))
        
        # Cleanup
        self.run_test("Delete Moderate Case", "DELETE", f"cases/{case_id}", 200)
        return result

    def test_clinical_depth_complex_case(self):
        """Test Clinical Depth Toggle - Complex Case Scenario"""
        print("\n🔬 Testing Clinical Depth Toggle - Complex Case")
        
        # Create case for complex scenario
        case_data = {
            "caseName": "Complex High-Risk Implant",
            "toothNumber": "9",  # Esthetic zone
            "optionalAge": 58,
            "optionalSex": "male"
        }
        
        success, response = self.run_test("Create Complex Case", "POST", "cases", 200, case_data)
        if not success or 'id' not in response:
            return False
            
        case_id = response['id']
        
        # Update with complex case planning data
        planning_data = {
            "planningData": {
                "boneAvailability": "insufficient",
                "estheticZone": "high",
                "softTissueBiotype": "thin",
                "smokingStatus": "current",
                "diabetesStatus": "uncontrolled",
                "medications": ["bisphosphonates"]
            }
        }
        
        success, _ = self.run_test("Update Complex Case Planning", "PUT", f"cases/{case_id}", 200, planning_data)
        if not success:
            return False
        
        # Analyze case
        success, analysis = self.run_test("Analyze Complex Case", "POST", f"cases/{case_id}/analyze", 200)
        if not success:
            return False
            
        # Verify Complex case results
        result = self.verify_clinical_depth_response(analysis, "Complex", case_id)
        self.clinical_depth_results.append(("Complex Case", result, analysis))
        
        # Cleanup
        self.run_test("Delete Complex Case", "DELETE", f"cases/{case_id}", 200)
        return result

    def verify_clinical_depth_response(self, analysis, expected_complexity, case_id):
        """Verify Clinical Depth Toggle response structure and content"""
        print(f"\n🔍 Verifying Clinical Depth Response for {expected_complexity} case...")
        
        issues = []
        
        # Check if analysis response exists
        if not analysis:
            issues.append("No analysis response received")
            return False
            
        # ===== STANDARD MODE FIELDS =====
        standard_fields = ['primaryIssue', 'caseComplexity', 'implantTiming', 'briefRationale']
        for field in standard_fields:
            if field not in analysis or not analysis[field]:
                issues.append(f"Missing or empty standard field: {field}")
        
        # ===== DETAILED MODE FIELDS =====
        detailed_fields = ['primaryIssueExpanded', 'complexityDrivers', 'immediatePlacementEligible', 
                          'immediatePlacementReasons', 'riskModifiers', 'clinicalRationale']
        for field in detailed_fields:
            if field not in analysis:
                issues.append(f"Missing detailed field: {field}")
        
        # ===== COMPLEXITY VERIFICATION =====
        if 'caseComplexity' in analysis:
            actual_complexity = analysis['caseComplexity']
            if actual_complexity != expected_complexity:
                issues.append(f"Expected complexity '{expected_complexity}', got '{actual_complexity}'")
        
        # ===== BACKUP AWARENESS (Complex cases only) =====
        if expected_complexity == "Complex":
            if 'backupAwareness' not in analysis or not analysis['backupAwareness']:
                issues.append("Complex case missing backupAwareness field")
        else:
            if 'backupAwareness' in analysis and analysis['backupAwareness']:
                issues.append(f"Non-complex case should not have backupAwareness, but got: {analysis['backupAwareness']}")
        
        # ===== IMMEDIATE PLACEMENT ELIGIBILITY =====
        if 'immediatePlacementEligible' in analysis:
            immediate_eligible = analysis['immediatePlacementEligible']
            if expected_complexity == "Complex" and immediate_eligible is True:
                issues.append("Complex cases should not be eligible for immediate placement")
        
        # ===== ARRAY LENGTH CONSTRAINTS =====
        if 'complexityDrivers' in analysis and isinstance(analysis['complexityDrivers'], list):
            if len(analysis['complexityDrivers']) > 3:
                issues.append(f"complexityDrivers should have max 3 items, got {len(analysis['complexityDrivers'])}")
        
        if 'clinicalRationale' in analysis and isinstance(analysis['clinicalRationale'], list):
            if len(analysis['clinicalRationale']) > 3:
                issues.append(f"clinicalRationale should have max 3 items, got {len(analysis['clinicalRationale'])}")
        
        # ===== CONTENT QUALITY CHECKS =====
        if 'primaryIssue' in analysis and analysis['primaryIssue']:
            if len(analysis['primaryIssue']) < 5:
                issues.append("primaryIssue seems too short")
        
        if 'briefRationale' in analysis and analysis['briefRationale']:
            if len(analysis['briefRationale']) < 10:
                issues.append("briefRationale seems too short")
        
        # Print verification results
        if issues:
            print(f"❌ Verification failed for {expected_complexity} case:")
            for issue in issues:
                print(f"   • {issue}")
            print(f"\nActual response structure:")
            print(json.dumps(analysis, indent=2))
            return False
        else:
            print(f"✅ {expected_complexity} case verification passed")
            print(f"   • Complexity: {analysis.get('caseComplexity', 'N/A')}")
            print(f"   • Primary Issue: {analysis.get('primaryIssue', 'N/A')}")
            print(f"   • Immediate Placement: {analysis.get('immediatePlacementEligible', 'N/A')}")
            if expected_complexity == "Complex":
                print(f"   • Backup Awareness: {'Present' if analysis.get('backupAwareness') else 'Missing'}")
            return True

    def print_clinical_depth_summary(self):
        """Print summary of Clinical Depth Toggle test results"""
        print("\n" + "=" * 60)
        print("🔬 CLINICAL DEPTH TOGGLE TEST SUMMARY")
        print("=" * 60)
        
        for test_name, passed, analysis in self.clinical_depth_results:
            status = "✅ PASSED" if passed else "❌ FAILED"
            complexity = analysis.get('caseComplexity', 'Unknown') if analysis else 'No Data'
            print(f"{status} - {test_name} (Complexity: {complexity})")
            
            if analysis and passed:
                print(f"   Primary Issue: {analysis.get('primaryIssue', 'N/A')}")
                print(f"   Timing: {analysis.get('implantTiming', 'N/A')}")
                immediate = analysis.get('immediatePlacementEligible')
                if immediate is not None:
                    print(f"   Immediate Placement: {'Yes' if immediate else 'No'}")
                if analysis.get('backupAwareness'):
                    print(f"   Backup Awareness: Present")
        
        passed_count = sum(1 for _, passed, _ in self.clinical_depth_results if passed)
        total_count = len(self.clinical_depth_results)
        print(f"\nClinical Depth Tests: {passed_count}/{total_count} passed")
        
        return passed_count == total_count

def main():
    print("🦷 Starting Dental Implant Planning API Tests")
    print("=" * 50)
    
    tester = DentalImplantAPITester()
    
    # Basic API tests
    basic_tests = [
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
    
    # Clinical Depth Toggle specific tests
    clinical_depth_tests = [
        tester.test_clinical_depth_simple_case,
        tester.test_clinical_depth_moderate_case,
        tester.test_clinical_depth_complex_case,
    ]
    
    print("\n🔧 Running Basic API Tests...")
    for test in basic_tests:
        test()
    
    print("\n🔬 Running Clinical Depth Toggle Tests...")
    for test in clinical_depth_tests:
        test()
    
    # Print Clinical Depth Toggle summary
    clinical_success = tester.print_clinical_depth_summary()
    
    # Print overall results
    print("\n" + "=" * 50)
    print(f"📊 Overall Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if tester.tests_passed == tester.tests_run and clinical_success:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())