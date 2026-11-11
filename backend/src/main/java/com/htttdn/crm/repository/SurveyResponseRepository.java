package com.htttdn.crm.repository;

import com.htttdn.crm.entity.SurveyResponse;
import org.springframework.data.jpa.repository.*;

public interface SurveyResponseRepository extends JpaRepository<SurveyResponse, Long> {
  boolean existsByCustomerIdAndSurveyId(Long customerId, Long surveyId);
}
