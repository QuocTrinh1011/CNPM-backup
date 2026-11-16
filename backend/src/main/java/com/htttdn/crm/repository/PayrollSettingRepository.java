package com.htttdn.crm.repository;

import com.htttdn.crm.entity.PayrollSetting;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PayrollSettingRepository extends JpaRepository<PayrollSetting, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select setting from PayrollSetting setting where setting.settingKey = :key order by setting.effectiveFrom")
    List<PayrollSetting> findAllForUpdate(@Param("key") String key);

    @Query("select setting from PayrollSetting setting where setting.settingKey = :key and setting.effectiveFrom <= :date and (setting.effectiveTo is null or setting.effectiveTo >= :date) order by setting.effectiveFrom desc")
    List<PayrollSetting> findEffective(@Param("key") String key, @Param("date") LocalDate date);
}
