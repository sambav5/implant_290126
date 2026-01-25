#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Add a Clinical Depth toggle with two modes:
  - Standard (default): Shows minimal output (primary issue, complexity, timing, brief rationale)
  - Detailed (toggle ON): Reveals additional reasoning layers with 6 sections:
    1. Primary Clinical Issue (Expanded)
    2. Case Complexity + Drivers
    3. Immediate Placement Eligibility Gate
    4. Risk Modifiers Detected
    5. Clinical Rationale
    6. Soft Backup Awareness (Complex cases only)
  
  Hard Constraints:
  - No new mandatory inputs
  - No increase in form completion time
  - Toggle controls output depth only, not input form
  - Supportive, senior-clinician voice
  - Output readable in under 90 seconds

backend:
  - task: "Clinical Depth Toggle - Backend Planning Engine"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: |
          Backend implementation is complete with RiskAssessment model containing all required fields:
          - Standard mode: primaryIssue, caseComplexity, implantTiming, briefRationale
          - Detailed mode: primaryIssueExpanded, complexityDrivers, immediatePlacementEligible, 
            immediatePlacementReasons, riskModifiers, clinicalRationale, backupAwareness
          The calculate_risk_assessment function generates all data using existing planning inputs only.
          Helper functions implemented: determine_primary_issue, expand_primary_issue, 
          determine_implant_timing, generate_brief_rationale.

frontend:
  - task: "Clinical Depth Toggle - Frontend UI"
    implemented: true
    working: true
    file: "/app/frontend/src/pages/PlanningWizard.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: true
        agent: "main"
        comment: |
          Frontend implementation is complete:
          - Toggle switch with Lightbulb/Zap icons implemented (line 182, 314-334)
          - Standard mode displays 4 key elements: primary issue, complexity badge, timing, brief rationale
          - Detailed mode displays 6 numbered sections with proper styling and conditional rendering
          - Immediate placement eligibility gate shown with color-coded feedback
          - Risk modifiers displayed with shield icons
          - Clinical rationale shown with info icons
          - Backup awareness shown for complex cases only
          - All content properly styled with clinical aesthetic

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: true

test_plan:
  current_focus:
    - "Clinical Depth Toggle - Backend Planning Engine"
    - "Clinical Depth Toggle - Frontend UI"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Implementation Status: COMPLETE
      
      The Clinical Depth Toggle feature is fully implemented in both backend and frontend.
      All services are running successfully after resolving node_modules dependency issues.
      
      Ready for testing:
      1. Create a new case
      2. Complete the planning wizard with various input combinations
      3. Verify Standard mode shows minimal output (4 elements)
      4. Toggle to Detailed mode and verify all 6 sections appear
      5. Test immediate placement eligibility logic
      6. Verify backup awareness appears only for Complex cases
      7. Test with different case complexity scenarios (Simple, Moderate, Complex)
      
      All constraints met:
      ✅ No new mandatory inputs
      ✅ No increase in form completion time
      ✅ Toggle controls output depth only
      ✅ Uses existing planning data
      ✅ Clinical supportive tone maintained