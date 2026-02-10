#!/usr/bin/env python3
"""
Detailed Clinical Depth Toggle Feature Verification
Tests the specific requirements from the review request
"""

import requests
import json
import sys

def test_clinical_depth_detailed():
    """Detailed test of Clinical Depth Toggle feature with response inspection"""
    
    base_url = "https://emergent-bug-fix.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    
    print("🔬 DETAILED CLINICAL DEPTH TOGGLE VERIFICATION")
    print("=" * 60)
    
    test_scenarios = [
        {
            "name": "Simple Case",
            "expected_complexity": "Simple",
            "case_data": {
                "caseName": "Simple Posterior Implant Test",
                "toothNumber": "30",
                "optionalAge": 35,
                "optionalSex": "male"
            },
            "planning_data": {
                "boneAvailability": "adequate",
                "estheticZone": "low", 
                "smokingStatus": "never",
                "diabetesStatus": "none",
                "medications": []
            }
        },
        {
            "name": "Moderate Case",
            "expected_complexity": "Moderate",
            "case_data": {
                "caseName": "Moderate Esthetic Zone Test",
                "toothNumber": "8",
                "optionalAge": 42,
                "optionalSex": "female"
            },
            "planning_data": {
                "boneAvailability": "moderate",
                "estheticZone": "high",
                "softTissueBiotype": "thin",
                "smokingStatus": "former",
                "diabetesStatus": "none"
            }
        },
        {
            "name": "Complex Case",
            "expected_complexity": "Complex",
            "case_data": {
                "caseName": "Complex High-Risk Test",
                "toothNumber": "9",
                "optionalAge": 58,
                "optionalSex": "male"
            },
            "planning_data": {
                "boneAvailability": "insufficient",
                "estheticZone": "high",
                "softTissueBiotype": "thin",
                "smokingStatus": "current",
                "diabetesStatus": "uncontrolled",
                "medications": ["bisphosphonates"]
            }
        }
    ]
    
    all_passed = True
    
    for scenario in test_scenarios:
        print(f"\n🧪 Testing {scenario['name']}...")
        print("-" * 40)
        
        try:
            # Create case
            response = requests.post(f"{api_url}/cases", json=scenario["case_data"])
            if response.status_code != 200:
                print(f"❌ Failed to create case: {response.status_code}")
                all_passed = False
                continue
                
            case_id = response.json()["id"]
            print(f"✅ Created case: {case_id}")
            
            # Update planning data
            update_data = {"planningData": scenario["planning_data"]}
            response = requests.put(f"{api_url}/cases/{case_id}", json=update_data)
            if response.status_code != 200:
                print(f"❌ Failed to update planning data: {response.status_code}")
                all_passed = False
                continue
                
            print("✅ Updated planning data")
            
            # Analyze case
            response = requests.post(f"{api_url}/cases/{case_id}/analyze")
            if response.status_code != 200:
                print(f"❌ Failed to analyze case: {response.status_code}")
                all_passed = False
                continue
                
            analysis = response.json()
            print("✅ Analysis completed")
            
            # Detailed verification
            passed = verify_response_structure(analysis, scenario["expected_complexity"], scenario["name"])
            if not passed:
                all_passed = False
            
            # Print detailed response for inspection
            print(f"\n📋 Full Response for {scenario['name']}:")
            print(json.dumps(analysis, indent=2))
            
            # Cleanup
            requests.delete(f"{api_url}/cases/{case_id}")
            print(f"🗑️  Cleaned up case {case_id}")
            
        except Exception as e:
            print(f"❌ Error testing {scenario['name']}: {str(e)}")
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("🎉 ALL CLINICAL DEPTH TOGGLE TESTS PASSED!")
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        return 1

def verify_response_structure(analysis, expected_complexity, test_name):
    """Verify the response structure matches Clinical Depth Toggle requirements"""
    
    print(f"\n🔍 Verifying {test_name} Response Structure...")
    
    issues = []
    
    # ===== STANDARD MODE FIELDS (Required for all cases) =====
    standard_fields = {
        'primaryIssue': 'Primary clinical issue identifier',
        'caseComplexity': 'Case complexity level',
        'implantTiming': 'Implant timing recommendation', 
        'briefRationale': 'Brief rationale summary'
    }
    
    for field, description in standard_fields.items():
        if field not in analysis:
            issues.append(f"Missing standard field: {field} ({description})")
        elif not analysis[field]:
            issues.append(f"Empty standard field: {field}")
        else:
            print(f"✅ {field}: {analysis[field]}")
    
    # ===== DETAILED MODE FIELDS (Required for toggle functionality) =====
    detailed_fields = {
        'primaryIssueExpanded': 'Expanded primary issue description',
        'complexityDrivers': 'List of complexity drivers (max 3)',
        'immediatePlacementEligible': 'Immediate placement eligibility gate',
        'immediatePlacementReasons': 'Reasons for immediate placement decision',
        'riskModifiers': 'Detected risk modifiers',
        'clinicalRationale': 'Clinical rationale points (max 3)'
    }
    
    for field, description in detailed_fields.items():
        if field not in analysis:
            issues.append(f"Missing detailed field: {field} ({description})")
        else:
            value = analysis[field]
            if field in ['complexityDrivers', 'clinicalRationale'] and isinstance(value, list):
                if len(value) > 3:
                    issues.append(f"{field} exceeds max length of 3: got {len(value)} items")
                print(f"✅ {field}: {len(value)} items")
            elif field == 'immediatePlacementEligible':
                print(f"✅ {field}: {value}")
            else:
                print(f"✅ {field}: Present")
    
    # ===== COMPLEXITY-SPECIFIC VERIFICATION =====
    if 'caseComplexity' in analysis:
        actual_complexity = analysis['caseComplexity']
        if actual_complexity != expected_complexity:
            issues.append(f"Expected complexity '{expected_complexity}', got '{actual_complexity}'")
        else:
            print(f"✅ Complexity matches expected: {actual_complexity}")
    
    # ===== BACKUP AWARENESS (Complex cases only) =====
    if expected_complexity == "Complex":
        if 'backupAwareness' not in analysis:
            issues.append("Complex case missing backupAwareness field")
        elif not analysis['backupAwareness']:
            issues.append("Complex case has empty backupAwareness")
        else:
            print(f"✅ backupAwareness: Present for Complex case")
    else:
        if 'backupAwareness' in analysis and analysis['backupAwareness']:
            issues.append(f"Non-complex case should not have backupAwareness")
        else:
            print(f"✅ backupAwareness: Correctly absent for {expected_complexity} case")
    
    # ===== IMMEDIATE PLACEMENT LOGIC =====
    if 'immediatePlacementEligible' in analysis:
        immediate_eligible = analysis['immediatePlacementEligible']
        if expected_complexity == "Complex":
            if immediate_eligible is True:
                issues.append("Complex cases should not be eligible for immediate placement")
            else:
                print("✅ Complex case correctly not eligible for immediate placement")
        
        # Check reasons are provided when not eligible
        if immediate_eligible is False:
            if 'immediatePlacementReasons' not in analysis or not analysis['immediatePlacementReasons']:
                issues.append("When immediate placement not eligible, reasons should be provided")
            else:
                print(f"✅ Immediate placement reasons provided: {len(analysis['immediatePlacementReasons'])} reasons")
    
    # ===== CONTENT QUALITY CHECKS =====
    if 'primaryIssue' in analysis and len(analysis['primaryIssue']) < 3:
        issues.append("primaryIssue seems too short")
    
    if 'briefRationale' in analysis and len(analysis['briefRationale']) < 10:
        issues.append("briefRationale seems too short")
    
    if 'primaryIssueExpanded' in analysis and len(analysis['primaryIssueExpanded']) < 20:
        issues.append("primaryIssueExpanded seems too short for detailed mode")
    
    # Print results
    if issues:
        print(f"\n❌ {test_name} Verification FAILED:")
        for issue in issues:
            print(f"   • {issue}")
        return False
    else:
        print(f"\n✅ {test_name} Verification PASSED - All requirements met!")
        return True

if __name__ == "__main__":
    sys.exit(test_clinical_depth_detailed())