package com.htttdn.crm.repository;

import com.htttdn.crm.entity.RefreshToken;
import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select t from RefreshToken t join fetch t.user where t.tokenHash=:tokenHash")
  Optional<RefreshToken> findForUpdate(@Param("tokenHash") String tokenHash);

  @Modifying
  @Query(
      "update RefreshToken t set t.status='REVOKED', t.revokeReason=:reason where"
          + " t.familyId=:familyId and t.status='ACTIVE'")
  int revokeFamily(@Param("familyId") String familyId, @Param("reason") String reason);

  @Modifying
  @Query(
      "update RefreshToken t set t.status='REVOKED', t.revokeReason='PASSWORD_CHANGED' where"
          + " t.user.id=:userId and t.status='ACTIVE'")
  int revokeByUserId(@Param("userId") Long userId);
}
