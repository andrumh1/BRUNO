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
# ## user_problem_statement: {problem_statement}
# ## backend:
# ##   - task: "Task name"
# ##     implemented: true
# ##     working: true  # or false or "NA"
# ##     file: "file_path.py"
# ##     stuck_count: 0
# ##     priority: "high"  # or "medium" or "low"
# ##     needs_retesting: false
# ##     status_history:
# ##         -working: true  # or false or "NA"
# ##         -agent: "main"  # or "testing" or "user"
# ##         -comment: "Detailed comment about status"
# ##
# ## frontend:
# ##   - task: "Task name"
# ##     implemented: true
# ##     working: true  # or false or "NA"
# ##     file: "file_path.js"
# ##     stuck_count: 0
# ##     priority: "high"  # or "medium" or "low"
# ##     needs_retesting: false
# ##     status_history:
# ##         -working: true  # or false or "NA"
# ##         -agent: "main"  # or "testing" or "user"
# ##         -comment: "Detailed comment about status"
# ##
# ## metadata:
# ##   created_by: "main_agent"
# ##   version: "1.0"
# ##   test_sequence: 0
# ##   run_ui: false
# ##
# ## test_plan:
# ##   current_focus:
# ##     - "Task name 1"
# ##     - "Task name 2"
# ##   stuck_tasks:
# ##     - "Task name with persistent issues"
# ##   test_all: false
# ##   test_priority: "high_first"  # or "sequential" or "stuck_first"
# ##
# ## agent_communication:
# ##     -agent: "main"  # or "testing" or "user"
# ##     -message: "Communication message between agents"

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
#    - Which tasks need testing (reference the test_plan)
#    - Any authentication details or configuration needed
#    - Specific test scenarios to focus on
#    - Any known issues or edge cases to verify
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

user_problem_statement: "BRUNO - app de tarjetas digitales con feed social, plantillas y NFC"
backend:
  - task: "Stripe: endpoints checkout suscripciones/pagos únicos y nuevo tipo de tarjeta curriculum"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: false
        agent: "main"
        comment: "Añadidos modelos PaymentTransaction, endpoints /api/payments/checkout, /api/payments/checkout/status y /api/webhook/stripe, y tipo de tarjeta curriculum en CardType. Falta validar flujo extremo a extremo."
      - working: true
        agent: "testing"
        comment: "✅ TODAS LAS PRUEBAS PASARON: 1) Backend arranca sin errores (health check OK), 2) Tipo curriculum funciona correctamente - se puede crear y leer tarjetas curriculum sin problemas, 3) Endpoint POST /api/payments/checkout funciona con package_id nfc_basic - devuelve session_id y url (checkout_url), 4) Endpoint GET /api/payments/checkout/status/{session_id} devuelve estado coherente con campos status y payment_status, 5) Webhook /api/webhook/stripe existe y maneja body vacío sin error 500. Stripe integración completamente funcional."
frontend:
  - task: "Tipo CURRICULUM visible en generador, plantillas base y ajustes visuales QR/burbuja"
    implemented: true
    working: false
    file: "frontend/src/pages/CreateCardPage.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: false
        agent: "main"
        comment: "Añadido tipo curriculum al selector de tipos, plantillas base de curriculum en TemplateSelector, badge de tipo curriculum en ViewCardPage y mantenido QR con ajustes de tamaño/color. Falta editor de bloques profesionales, PDF y anexos."
metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 3
  run_ui: true

test_plan:
  current_focus:
    - "Stripe checkout suscripciones/pagos únicos (flujo básico)"
    - "Creación/edición de tarjeta tipo curriculum con plantillas base"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Por favor probar: 1) creación/edición de tarjetas tipo curriculum (aunque sin bloques profesionales avanzados aún), y 2) invocación básica de /api/payments/checkout desde PricingPage o mediante curl para confirmar que la sesión de checkout se crea sin errores y que /api/payments/checkout/status responde correctamente."