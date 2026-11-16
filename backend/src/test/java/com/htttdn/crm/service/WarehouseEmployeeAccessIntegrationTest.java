package com.htttdn.crm.service;

import com.htttdn.crm.entity.EmployeeProfile;
import com.htttdn.crm.entity.User;
import com.htttdn.crm.exception.ApiException;
import com.htttdn.crm.repository.EmployeeProfileRepository;
import com.htttdn.crm.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:warehouseEmployeeAccess;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.rate-limit.enabled=false"
})
@Transactional
class WarehouseEmployeeAccessIntegrationTest {
    private static final String PASSWORD = "TestPassword123!";

    @Autowired UserRepository users;
    @Autowired EmployeeProfileRepository profiles;
    @Autowired PasswordEncoder encoder;
    @Autowired ManagerAuthService managerAuth;
    @Autowired WarehouseEmployeeAccessService access;

    @Test
    void currentDatabaseWorkAreaGrantsAndRevokesAccessRegardlessOfJobTitle() {
        EmployeeFixture fixture = employee("WAREHOUSE", "Nhân viên bán hàng");

        EmployeeProfile authorized = access.requireWarehouseEmployee(fixture.authorization());
        assertEquals(fixture.user().getId(), authorized.getEmployeeId());
        assertEquals("WAREHOUSE", authorized.getWorkArea());

        EmployeeProfile profile = profiles.findById(fixture.user().getId()).orElseThrow();
        profile.setWorkArea("GENERAL");
        profiles.saveAndFlush(profile);

        ApiException denied = assertThrows(ApiException.class,
                () -> access.requireWarehouseEmployee(fixture.authorization()));
        assertEquals("WAREHOUSE_EMPLOYEE_REQUIRED", denied.code());
    }

    @Test
    void salesOrGeneralEmployeeIsDeniedEvenWhenJobTitleSaysWarehouse() {
        for (String workArea : new String[]{"GENERAL", "SALES"}) {
            EmployeeFixture fixture = employee(workArea, "Nhân viên kho");

            ApiException denied = assertThrows(ApiException.class,
                    () -> access.requireWarehouseEmployee(fixture.authorization()));
            assertEquals("WAREHOUSE_EMPLOYEE_REQUIRED", denied.code());
        }
    }

    @Test
    void requiresAnUnlockedActiveEmployeeAccountAndProfile() {
        EmployeeFixture fixture = employee("WAREHOUSE", "Nhân viên kho");
        User account = users.findById(fixture.user().getId()).orElseThrow();
        account.setLocked(true);
        users.saveAndFlush(account);
        assertDenied(fixture.authorization());

        account.setLocked(false);
        account.setRole("MANAGER_SALES");
        users.saveAndFlush(account);
        assertDenied(fixture.authorization());

        account.setRole("EMPLOYEE");
        users.saveAndFlush(account);
        EmployeeProfile profile = profiles.findById(account.getId()).orElseThrow();
        profile.setEmploymentStatus("TERMINATED");
        profiles.saveAndFlush(profile);
        assertDenied(fixture.authorization());
    }

    private void assertDenied(String authorization) {
        ApiException denied = assertThrows(ApiException.class,
                () -> access.requireWarehouseEmployee(authorization));
        assertEquals("WAREHOUSE_EMPLOYEE_REQUIRED", denied.code());
    }

    private EmployeeFixture employee(String workArea, String jobTitle) {
        String email = "warehouse-access-" + UUID.randomUUID() + "@test.local";
        User user = new User();
        user.setEmail(email);
        user.setFullName("Warehouse access test");
        user.setPasswordHash(encoder.encode(PASSWORD));
        user.setRole("EMPLOYEE");
        user = users.saveAndFlush(user);

        EmployeeProfile profile = new EmployeeProfile();
        profile.setEmployeeId(user.getId());
        profile.setAccount(user);
        profile.setEmployeeCode("WH-" + UUID.randomUUID());
        profile.setJobTitle(jobTitle);
        profile.setHireDate(LocalDate.of(2025, 1, 1));
        profile.setWorkArea(workArea);
        profiles.saveAndFlush(profile);

        String authorization = "Bearer " + managerAuth.login(email, PASSWORD).accessToken();
        return new EmployeeFixture(user, authorization);
    }

    private record EmployeeFixture(User user, String authorization) {}
}
