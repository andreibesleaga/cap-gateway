Feature: A security reviewer probes the gateway with bad input
  As a security reviewer
  I want malformed, oversized and hostile input rejected before it reaches the mesh
  So that only valid CAP 1.2 alerts are ever processed

  Background:
    Given the translation mesh is running

  Scenario: Malformed XML is rejected
    Given the message:
      """
      <alert><identifier>x</alert>
      """
    When the alert is posted to the gateway
    Then the response status is 400
    And the error message says "message is not well-formed XML"
    And the response has no X-Translation header
    And no responder received it

  Scenario: Well-formed XML that is not CAP is rejected
    Given the message:
      """
      <?xml version="1.0"?><note><to>you</to></note>
      """
    When the alert is posted to the gateway
    Then the response status is 400
    And the error message says "XML does not conform to the Common Alert Protocol 1.2 XSD Schema"
    And no responder received it

  Scenario: A CAP alert with a value outside an enumeration is rejected
    Given the CAP alert "alert-ro.xml" with "<urgency>Expected</urgency>" replaced by "<urgency>Soon</urgency>"
    When the alert is posted to the gateway
    Then the response status is 400
    And the error message says "XML does not conform to the Common Alert Protocol 1.2 XSD Schema"
    And no responder received it

  Scenario: A DOCTYPE with an external entity is refused before parsing
    Given the message:
      """
      <?xml version="1.0"?><!DOCTYPE alert [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><alert>&xxe;</alert>
      """
    When the alert is posted to the gateway
    Then the response status is 400
    And the error message says "DOCTYPE declarations are not allowed"
    And no responder received it

  Scenario: An oversized request is refused with 413
    Given a message of 200 kilobytes
    When the alert is posted to the gateway
    Then the response status is 413
    And the error message says "Request body larger than 100kb"
    And no responder received it

  Scenario: A body that is not JSON is malformed
    When the raw body "{\"message\": " is posted
    Then the response status is 400
    And the error message says "Malformed Request"

  Scenario: A message that is not a string is rejected
    When the message is posted as the value 42
    Then the response status is 400
    And the error message says "message must be a string containing CAP XML"

  Scenario: An unknown route is a JSON 404
    When a client requests "/app/admin/../../etc/passwd"
    Then the response status is 404
    And the error message says "Not found"
