package com.cnpm.clothingstore.service;
import com.cnpm.clothingstore.exception.ApiException;
import com.cnpm.clothingstore.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PasswordRecoveryPolicyTest {
 @Test void requiresBothExplicitFlagAndDevelopmentProfile(){
  UserRepository users=mock(UserRepository.class); PasswordResetTokenRepository tokens=mock(PasswordResetTokenRepository.class);
  AuthService service=new AuthService(users,null,tokens,null,null,null);
  MockEnvironment environment=new MockEnvironment();ReflectionTestUtils.setField(service,"environment",environment);
  assertFalse(service.passwordRecoveryEnabled());
  for(String profile:new String[]{"default","production","development"}){
   environment.setActiveProfiles(profile);ReflectionTestUtils.setField(service,"developmentResetEnabled",false);
   assertFalse(service.passwordRecoveryEnabled());
   assertThrows(ApiException.class,()->service.requestPasswordReset("a@example.com"));
   assertThrows(ApiException.class,()->service.resetPassword("a@example.com","123456","Password123"));
  }
  ReflectionTestUtils.setField(service,"developmentResetEnabled",true);environment.setActiveProfiles("production");
  assertFalse(service.passwordRecoveryEnabled());assertThrows(ApiException.class,()->service.requestPasswordReset("a@example.com"));
  verifyNoInteractions(users,tokens);
  environment.setActiveProfiles("development");assertTrue(service.passwordRecoveryEnabled());
 }
}
