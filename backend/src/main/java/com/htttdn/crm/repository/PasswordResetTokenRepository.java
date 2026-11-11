package com.htttdn.crm.repository;

import com.htttdn.crm.entity.PasswordResetToken;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {
  Optional<PasswordResetToken> findByTokenHash(String tokenHash);

  Optional<PasswordResetToken> findFirstByCustomerIdOrderByCreatedAtDesc(Long customerId);

  void deleteByCustomerId(Long customerId);
}
