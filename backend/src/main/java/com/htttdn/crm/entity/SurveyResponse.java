package com.htttdn.crm.entity;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;

@Entity
@Table(
    name = "survey_responses",
    uniqueConstraints = @UniqueConstraint(columnNames = {"customer_id", "survey_id"}))
public class SurveyResponse {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "customer_id")
  private User customer;

  @ManyToOne(optional = false, fetch = FetchType.LAZY)
  @JoinColumn(name = "survey_id")
  private Survey survey;

  @JsonManagedReference
  @OneToMany(
      mappedBy = "response",
      cascade = CascadeType.ALL,
      orphanRemoval = true,
      fetch = FetchType.EAGER)
  private List<SurveyAnswer> answers = new ArrayList<>();

  private Instant createdAt = Instant.now();

  public SurveyResponse() {}

  public Long getId() {
    return id;
  }

  public User getCustomer() {
    return customer;
  }

  public void setCustomer(User v) {
    customer = v;
  }

  public Survey getSurvey() {
    return survey;
  }

  public void setSurvey(Survey v) {
    survey = v;
  }

  public List<SurveyAnswer> getAnswers() {
    return answers;
  }

  public void setAnswers(List<SurveyAnswer> v) {
    answers = v;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant v) {
    createdAt = v;
  }
}
