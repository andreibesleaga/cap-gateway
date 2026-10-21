Feature: An operator runs and scales the mesh
  As the operator of the gateway and its responders
  I want the load spread over responders and every failure reported truthfully
  So that I can scale the mesh and alerts keep flowing when translation breaks

  Scenario: Two responders share the requests round-robin
    Given the translation mesh is running
    And the CAP alert "alert-en.xml"
    When 6 alerts are posted to the gateway
    Then every response status is 200
    And each of the 2 responders handled 3 of them

  Scenario: The health endpoint reports the connected responders
    Given the translation mesh is running
    When the operator checks the health endpoint
    Then the response status is 200
    And the health report shows 2 responders

  Scenario: Without a responder the gateway answers 503 at once
    Given a gateway with no responder
    And the CAP alert "alert-ro.xml"
    When the alert is posted to the gateway
    Then the response status is 503
    And the error message says "No translation responder available"
    And the response took less than 2 seconds
    When the operator checks the health endpoint
    Then the response status is 503
    And the health report shows 0 responders

  Scenario: An unreachable engine still delivers the original alert, marked failed
    Given a mesh whose translation engine is unreachable
    And the CAP alert "alert-ro.xml"
    When the alert is posted to the gateway
    Then the response status is 200
    And the X-Translation header is "failed"
    And the response body is the alert exactly as sent

  Scenario: A silent engine is cut off by the translator timeout
    Given a mesh whose translation engine never answers
    And the CAP alert "alert-ro.xml"
    When the alert is posted to the gateway
    Then the response status is 200
    And the X-Translation header is "failed"
    And the response body is the alert exactly as sent
    And the response took less than 5 seconds

  Scenario: An LLM that breaks the JSON contract is retried once, then nothing is appended
    Given a mesh whose LLM answers with invalid JSON
    And the CAP alert "alert-ro.xml"
    When the alert is posted to the gateway
    Then the response status is 200
    And the X-Translation header is "failed"
    And the response body is the alert exactly as sent
    And the fake LLM received 2 requests
