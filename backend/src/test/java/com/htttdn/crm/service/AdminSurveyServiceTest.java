package com.htttdn.crm.service;
import com.htttdn.crm.dto.admin.AdminDtos.*;
import com.htttdn.crm.entity.*;
import com.htttdn.crm.repository.SurveyRepository;
import com.htttdn.crm.repository.UserRepository;
import com.htttdn.crm.exception.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class AdminSurveyServiceTest {
 final SurveyRepository repo=mock(SurveyRepository.class);
 final UserRepository users=mock(UserRepository.class);
 final AdminSurveyService service=new AdminSurveyService(repo);
 AdminSurveyServiceTest(){ReflectionTestUtils.setField(service,"users",users);}
 @Test void createsOrderedChoiceQuestionsAndDefaultsRequired(){
  when(repo.save(any())).thenAnswer(a->a.getArgument(0));
  Survey s=service.create(new SurveyRequest("Test","",null,null,List.of(new QuestionRequest("One","SINGLE","[\"A\",\"B\"]",null),new QuestionRequest("Many","MULTIPLE_CHOICE","[\"A\",\"B\"]",false))));
  assertEquals("SINGLE_CHOICE",s.getQuestions().get(0).getType());assertTrue(s.getQuestions().get(0).isRequired());assertFalse(s.getQuestions().get(1).isRequired());assertEquals(1,s.getQuestions().get(1).getDisplayOrder());
 }
 @Test void rejectsEmptySurveyAndInvalidOptions(){
  assertThrows(ApiException.class,()->service.create(new SurveyRequest("Test","",null,null,List.of())));
  for(String raw:List.of("[]","[\"A\"]","[\"A\",\" A \"]","[\"\",\"B\"]","{}"))assertThrows(ApiException.class,()->SurveyValidation.options(raw));
 }
 @Test void unpublishesAndSoftDeletesWithoutRemovingQuestions(){
  Survey s=new Survey();s.setStatus("PUBLISHED");s.getQuestions().add(new SurveyQuestion());
  when(repo.findForUpdate(1L)).thenReturn(Optional.of(s));
  when(users.findActiveCustomers("",org.springframework.data.domain.PageRequest.of(0,100))).thenReturn(new PageImpl<>(List.of()));
  service.publish(1L,false);assertEquals("DRAFT",s.getStatus());
  service.publish(1L,true);assertEquals("PUBLISHED",s.getStatus());
  service.delete(1L);var date=s.getDeletedAt();service.delete(1L);
  assertEquals(date,s.getDeletedAt());assertEquals(1,s.getQuestions().size());
  assertThrows(ApiException.class,()->service.publish(1L,true));verify(repo,never()).deleteById(any());
 }
 @Test void preventsPublishingEmptyLegacySurvey(){
  when(repo.findForUpdate(1L)).thenReturn(Optional.of(new Survey()));
  assertThrows(ApiException.class,()->service.publish(1L,true));
 }
 @Test void selectedRecipientsAreBatchLoadedAndDeduplicated(){
  User first=customer(1L), third=customer(3L);
  when(repo.save(any())).thenAnswer(a->a.getArgument(0));
  when(users.findAllById(List.of(3L,1L,3L))).thenReturn(List.of(first,third));

  Survey survey=service.create(selectedRequest(List.of(3L,1L,3L)));

  assertEquals(Set.of(1L,3L),survey.getRecipients());
  verify(users,times(1)).findAllById(List.of(3L,1L,3L));
  verify(users,never()).findById(any());
 }
 @Test void selectedRecipientValidationUsesRequestedIdOrderForMissingIds(){
  User locked=customer(2L);locked.setLocked(true);
  when(users.findAllById(List.of(1L,2L))).thenReturn(List.of(locked));

  ApiException exception=assertThrows(ApiException.class,()->service.create(selectedRequest(List.of(1L,2L))));

  assertEquals("Không tìm thấy khách hàng.",exception.getMessage());
  verify(users,times(1)).findAllById(List.of(1L,2L));
 }
 @Test void selectedRecipientsRejectLockedDeletedAndNonCustomerUsers(){
  User locked=customer(1L);locked.setLocked(true);
  User deleted=customer(2L);deleted.setDeletedAt(java.time.Instant.parse("2026-01-01T00:00:00Z"));
  User manager=customer(3L);manager.setRole("MANAGER");

  for(User invalid:List.of(locked,deleted,manager)){
   when(users.findAllById(List.of(invalid.getId()))).thenReturn(List.of(invalid));
   ApiException exception=assertThrows(ApiException.class,()->service.create(selectedRequest(List.of(invalid.getId()))));
   assertEquals("Khách hàng không hoạt động.",exception.getMessage());
  }
 }
 @Test void selectedRecipientsKeepRepositoryNullIdFailure(){
  assertThrows(IllegalArgumentException.class,()->service.create(selectedRequest(Arrays.asList((Long)null))));
  verify(users,never()).findAllById(any());
 }
 private static SurveyRequest selectedRequest(List<Long> customerIds){
  return new SurveyRequest("Test","",null,null,List.of(new QuestionRequest("Question","SINGLE_CHOICE","[\"A\",\"B\"]",true)),null,"SELECTED",customerIds);
 }
 private static User customer(Long id){
  User user=new User();ReflectionTestUtils.setField(user,"id",id);return user;
 }
}
