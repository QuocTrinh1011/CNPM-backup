package com.cnpm.clothingstore.repository;

import com.cnpm.clothingstore.entity.PasswordResetToken; import org.springframework.data.jpa.repository.*; import java.util.*;
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken,Long> { Optional<PasswordResetToken> findByTokenHash(String tokenHash); Optional<PasswordResetToken> findFirstByCustomerIdOrderByCreatedAtDesc(Long customerId); void deleteByCustomerId(Long customerId); }
