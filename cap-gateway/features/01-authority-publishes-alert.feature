@translation
Feature: An alerting authority publishes a non-English alert
  As an alerting authority that publishes CAP 1.2 alerts in its own language
  I want the gateway to add an English version without changing what I published
  So that English-speaking responders and systems can act on my alert

  Background:
    Given the translation mesh is running

  @llm
  Scenario: An English alert passes through byte-identical
    Given the CAP alert "alert-en.xml"
    When the alert is posted to the gateway
    Then the response status is 200
    And the X-Translation header is "passthrough"
    And the response is XML
    And the response body is the alert exactly as sent

  Scenario Outline: A <language> alert gets an appended en-US info block
    Given the CAP alert "<file>"
    When the alert is posted to the gateway
    Then the response status is 200
    And the X-Translation header is "translated"
    And the response has 1 original and 1 appended en-US info block
    And the original alert is unchanged inside the response
    And the appended block copies every enumerated and coded field verbatim
    And the appended block translates the free-text fields
    And the response validates against the CAP 1.2 schema

    @llm
    Examples: also run against the LLM
      | language | file         |
      | Romanian | alert-ro.xml |
      | German   | alert-de.xml |

    Examples:
      | language | file         |
      | French   | alert-fr.xml |
      | Spanish  | alert-es.xml |
      | Finnish  | alert-fi.xml |

  @real-engine
  Scenario Outline: A real engine turns a <language> alert into readable English
    Given the CAP alert "<file>"
    When the alert is posted to the gateway
    Then the X-Translation header is "translated"
    And the appended description and instruction read as English
    And the appended text mentions one of "<keywords>"

    @llm
    Examples: also run against the LLM
      | language | file         | keywords        |
      | French   | alert-fr.xml | flood, flooding |
      | Spanish  | alert-es.xml | flood, flooding |

    Examples:
      | language | file         | keywords                    |
      | Romanian | alert-ro.xml | storm, hail                 |
      | German   | alert-de.xml | flood, flooding, high water |
      | Finnish  | alert-fi.xml | flood, flooding, high water |

  @llm
  Scenario: A missing language means en-US, so nothing is added
    Given the CAP alert "no-language.xml"
    When the alert is posted to the gateway
    Then the response status is 200
    And the X-Translation header is "passthrough"
    And the response body is the alert exactly as sent

  @llm
  Scenario: An alert that already carries English gets no duplicate
    Given the CAP alert "ro-with-en.xml"
    When the alert is posted to the gateway
    Then the response status is 200
    And the X-Translation header is "passthrough"
    And the response body is the alert exactly as sent

  @llm
  Scenario: Every Romanian block of a multi-block alert gets its own English copy
    Given the CAP alert "multi-ro.xml"
    When the alert is posted to the gateway
    Then the X-Translation header is "translated"
    And the response has 2 originals and 2 appended en-US info blocks
    And the original alert is unchanged inside the response
    And the appended block copies every enumerated and coded field verbatim
    And the appended block translates the free-text fields
    And the response validates against the CAP 1.2 schema

  Scenario: With Romanian and French blocks only the first language is copied
    Given the CAP alert "mixed-ro-fr.xml"
    When the alert is posted to the gateway
    Then the X-Translation header is "translated"
    And the response has 2 originals and 1 appended en-US info block
    And the appended block was copied from the "ro-RO" block
    And the appended block translates the free-text fields
    And the response validates against the CAP 1.2 schema

  @llm
  Scenario: Diacritics, entities, comments and CDATA survive the round trip
    Given the CAP alert "cdata-utf8.xml"
    When the alert is posted to the gateway
    Then the X-Translation header is "translated"
    And the original alert is unchanged inside the response
    And the response still contains the original CDATA section
    And the appended block copies every enumerated and coded field verbatim
    And the appended block translates the free-text fields
    And the response validates against the CAP 1.2 schema

  Scenario: Enumerated, coded, dated and geometric fields are copied verbatim
    Given the CAP alert "rich-ro.xml"
    When the alert is posted to the gateway
    Then the X-Translation header is "translated"
    And the response has 1 original and 1 appended en-US info block
    And the appended block copies every enumerated and coded field verbatim
    And the appended block translates the free-text fields
    And the response validates against the CAP 1.2 schema
