package com.htttdn.crm.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;

@Entity
@Table(name = "survey_questions")
public class SurveyQuestion {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @JsonBackReference
  @ManyToOne
  @JoinColumn(name = "survey_id", nullable = false)
  private Survey survey;

  @Column(nullable = false, length = 1000)
  private String text;

  private String type = "TEXT";
  private int displayOrder;

  @Column(length = 4000)
  private String optionsJson;

  private boolean required = true;

  public SurveyQuestion() {}

  public Long getId() {
    return id;
  }

  public Survey getSurvey() {
    return survey;
  }

  public void setSurvey(Survey v) {
    survey = v;
  }

  public String getText() {
    return text;
  }

  public void setText(String v) {
    text = v;
  }

  public String getType() {
    return type;
  }

  public void setType(String v) {
    type = v;
  }

  public int getDisplayOrder() {
    return displayOrder;
  }

  public void setDisplayOrder(int v) {
    displayOrder = v;
  }

  public String getOptionsJson() {
    return optionsJson;
  }

  public void setOptionsJson(String v) {
    optionsJson = v;
  }

  public boolean isRequired() {
    return required;
  }

  public void setRequired(boolean v) {
    required = v;
  }
}
