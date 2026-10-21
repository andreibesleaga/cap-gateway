Feature: A downstream application consumes alerts as JSON
  As the developer of an application that reads alerts as JSON
  I want the same content as the XML output, already parsed
  So that I can use the English block without an XML parser

  Background:
    Given the translation mesh is running

  @translation
  Scenario: A Romanian alert as JSON carries the original and the English info
    Given the CAP alert "alert-ro.xml"
    When the alert is posted to the gateway asking for JSON
    Then the response status is 200
    And the response is JSON
    And the X-Translation header is "translated"
    And the JSON alert has 2 info entries and the last has language "en-US"
    And the JSON alert keeps the CAP namespace and the identifier "EXAMPLE-RO-0001"
    And the last JSON info entry is the English copy of the first

  Scenario: An English alert as JSON is passed through
    Given the CAP alert "alert-en.xml"
    When the alert is posted to the gateway asking for JSON
    Then the response status is 200
    And the response is JSON
    And the X-Translation header is "passthrough"
    And the JSON alert has 1 info entry and the last has language "en-US"

  Scenario: Only the boolean true selects JSON
    Given the CAP alert "alert-en.xml"
    When the alert is posted with exportJson set to the string "true"
    Then the response status is 200
    And the response is XML
