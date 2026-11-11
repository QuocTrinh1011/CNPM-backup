package com.htttdn.crm.entity;

import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.*;

@Entity
@Table(name = "survey_definitions")
public class Survey {
  private String audience = "ALL";

  public String getAudience() {
    return audience;
  }

  public void setAudience(String value) {
    audience = value;
  }

  @Transient
  public int getRecipientCount() {
    return recipients.size();
  }

  @com.fasterxml.jackson.annotation.JsonIgnore
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(name = "survey_recipients", joinColumns = @JoinColumn(name = "survey_id"))
  @Column(name = "customer_id")
  private Set<Long> recipients = new HashSet<>();

  @com.fasterxml.jackson.annotation.JsonIgnore
  public Set<Long> getRecipients() {
    return recipients;
  }

  @com.fasterxml.jackson.annotation.JsonIgnore
  @ElementCollection(fetch = FetchType.EAGER)
  @CollectionTable(
      name = "survey_notified_customers",
      joinColumns = @JoinColumn(name = "survey_id"))
  @Column(name = "customer_id")
  private Set<Long> notified = new HashSet<>();

  @com.fasterxml.jackson.annotation.JsonIgnore
  public Set<Long> getNotified() {
    return notified;
  }

  @Embedded private SurveyReward reward = new SurveyReward();

  public SurveyReward getReward() {
    return reward;
  }

  public void setReward(SurveyReward v) {
    reward = v;
  }

  private Instant deletedAt;

  public Instant getDeletedAt() {
    return deletedAt;
  }

  public void setDeletedAt(Instant v) {
    deletedAt = v;
  }

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private String title;

  @Column(length = 4000)
  private String description;

  private String status = "DRAFT";
  private Instant startsAt;
  private Instant endsAt;
  private Instant createdAt = Instant.now();

  @JsonManagedReference
  @OrderBy("displayOrder ASC")
  @OneToMany(
      mappedBy = "survey",
      cascade = CascadeType.ALL,
      orphanRemoval = true,
      fetch = FetchType.EAGER)
  private List<SurveyQuestion> questions = new ArrayList<>();

  public Survey() {}

  public Long getId() {
    return id;
  }

  public String getTitle() {
    return title;
  }

  public void setTitle(String v) {
    title = v;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String v) {
    description = v;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String v) {
    status = v;
  }

  public Instant getStartsAt() {
    return startsAt;
  }

  public void setStartsAt(Instant v) {
    startsAt = v;
  }

  public Instant getEndsAt() {
    return endsAt;
  }

  public void setEndsAt(Instant v) {
    endsAt = v;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(Instant v) {
    createdAt = v;
  }

  public List<SurveyQuestion> getQuestions() {
    return questions;
  }

  public void setQuestions(List<SurveyQuestion> v) {
    questions = v;
  }
}
