package ke.saki.backend;

import java.util.Map;
import java.util.UUID;

import ke.saki.backend.admin.ModelMetadataProvider;
import ke.saki.backend.user.UserAccount;
import ke.saki.backend.user.UserAccountRepository;
import ke.saki.backend.user.UserRole;
import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ApiFlowTests {
    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserAccountRepository users;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @MockitoBean
    private ModelMetadataProvider modelMetadataProvider;

    @Test
    void registrationProtectsIdeasAndEnforcesOwnerIsolation() throws Exception {
        String firstToken = register("first-" + UUID.randomUUID() + "@example.test");

        MvcResult created = mvc.perform(post("/api/ideas")
                        .header("Authorization", "Bearer " + firstToken)
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(ideaPayload())))
                .andExpect(status().isCreated())
                .andReturn();
        String ideaId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        String secondToken = register("second-" + UUID.randomUUID() + "@example.test");
        mvc.perform(get("/api/ideas/" + ideaId)
                        .header("Authorization", "Bearer " + secondToken))
                .andExpect(status().isNotFound());

        MvcResult ownIdeas = mvc.perform(get("/api/ideas")
                        .header("Authorization", "Bearer " + firstToken))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(objectMapper.readTree(ownIdeas.getResponse().getContentAsString())).hasSize(1);
    }

    @Test
    void protectedEndpointRejectsRequestsWithoutToken() throws Exception {
        mvc.perform(get("/api/ideas")).andExpect(status().isUnauthorized());
    }

    @Test
    void onlineResearchIsOwnerScopedAndRequiresServerConfiguration() throws Exception {
        String ownerToken = register("research-owner-" + UUID.randomUUID() + "@example.test");
        MvcResult created = mvc.perform(post("/api/ideas")
                        .header("Authorization", "Bearer " + ownerToken)
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(ideaPayload())))
                .andExpect(status().isCreated())
                .andReturn();
        String ideaId = objectMapper.readTree(created.getResponse().getContentAsString())
                .get("id").asText();

        String otherToken = register("research-other-" + UUID.randomUUID() + "@example.test");
        mvc.perform(post("/api/ideas/" + ideaId + "/research")
                        .header("Authorization", "Bearer " + otherToken))
                .andExpect(status().isNotFound());

        MvcResult researchError = mvc.perform(post("/api/ideas/" + ideaId + "/research")
                        .header("Authorization", "Bearer " + ownerToken))
                .andExpect(status().isServiceUnavailable())
                .andReturn();
        assertThat(objectMapper.readTree(researchError.getResponse().getContentAsString())
                .get("message").asText()).contains("TAVILY_API_KEY");
    }

    @Test
    void regularUsersCannotAccessModelAdministration() throws Exception {
        String email = "user-" + UUID.randomUUID() + "@example.test";
        MvcResult registration = mvc.perform(post("/api/auth/register")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", email, "password", "regular-password-123"))))
                .andExpect(status().isOk())
                .andReturn();
        var response = objectMapper.readTree(registration.getResponse().getContentAsString());
        assertThat(response.get("role").asText()).isEqualTo("USER");

        mvc.perform(get("/api/admin/model")
                        .header("Authorization", "Bearer " + response.get("accessToken").asText()))
                .andExpect(status().isForbidden());
    }

    @Test
    void administratorsCanViewCurrentModelMetadata() throws Exception {
        String email = "admin-" + UUID.randomUUID() + "@example.test";
        users.save(new UserAccount(email, passwordEncoder.encode("admin-password-123"), UserRole.ADMIN));
        when(modelMetadataProvider.getCurrentModel())
                .thenReturn(objectMapper.readTree("{\"version\":\"test-version\"}"));

        MvcResult login = mvc.perform(post("/api/auth/login")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", email, "password", "admin-password-123"))))
                .andExpect(status().isOk())
                .andReturn();
        var response = objectMapper.readTree(login.getResponse().getContentAsString());
        assertThat(response.get("role").asText()).isEqualTo("ADMIN");

        mvc.perform(get("/api/admin/model")
                        .header("Authorization", "Bearer " + response.get("accessToken").asText()))
                .andExpect(status().isOk())
                .andExpect(result -> assertThat(objectMapper.readTree(result.getResponse().getContentAsString())
                        .get("version").asText()).isEqualTo("test-version"));
    }

    private String register(String email) throws Exception {
        MvcResult response = mvc.perform(post("/api/auth/register")
                        .contentType(APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                Map.of("email", email, "password", "test-password-123"))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(response.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    private Map<String, Object> ideaPayload() {
        return Map.of(
                "name", "Nairobi test bakery",
                "sectorGroup", "Food & accommodation",
                "location", "Westlands",
                "premisesGroup", "Commercial premises",
                "initialCapitalKsh", 300000,
                "registered", true,
                "mainBuyerCode", 4,
                "capitalSourceCode", 1,
                "foundingEmployees", 2);
    }
}
