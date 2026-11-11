package com.htttdn.crm.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;

@Entity
@Table(name = "survey_answers")
public class SurveyAnswer {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @JsonBackReference
  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "response_id")
  private SurveyResponse response;

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "question_id")
  private SurveyQuestion question;

  @Column(nullable = false, length = 4000)
  private String answer;

  public SurveyAnswer() {}

  public Long getId() {
    return id;
  }

  public SurveyResponse getResponse() {
    return response;
  }

  public void setResponse(SurveyResponse v) {
    response = v;
  }

  public SurveyQuestion getQuestion() {
    return question;
  }

  public void setQuestion(SurveyQuestion v) {
    question = v;
  }

  public String getAnswer() {
    return answer;
  }

  public void setAnswer(String v) {
    answer = v;
  }
}
