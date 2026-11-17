package ke.saki.backend;

import java.util.Map;
import java.util.UUID;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

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
