package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.SurveyResponse; import org.springframework.data.jpa.repository.*;

public interface SurveyResponseRepository extends JpaRepository<SurveyResponse,Long> { boolean existsByCustomerIdAndSurveyId(Long customerId,Long surveyId); }
