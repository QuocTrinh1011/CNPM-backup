package com.htttdn.crm.repository;

import com.htttdn.crm.entity.*;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;

public interface SurveyRepository extends JpaRepository<Survey, Long> {
  Page<Survey> findByDeletedAtIsNull(Pageable p);

  Page<Survey> findByStatusAndDeletedAtIsNull(String status, Pageable p);

  long countByDeletedAtIsNull();

  long countByStatusAndDeletedAtIsNull(String status);

  @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  @Query("select s from Survey s where s.id=:id")
  Optional<Survey> findForUpdate(@org.springframework.data.repository.query.Param("id") Long id);

  Page<Survey> findByStatus(String status, Pageable p);

  long countByStatus(String status);

  Optional<Survey> findByIdAndStatus(Long id, String status);

  List<Survey> findByStatusOrderByCreatedAtDesc(String status);
}
