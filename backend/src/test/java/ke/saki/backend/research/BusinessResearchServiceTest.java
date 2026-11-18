package ke.saki.backend.research;

import java.util.List;
import java.util.UUID;

import ke.saki.backend.idea.BusinessIdea;
import ke.saki.backend.idea.BusinessIdeaService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class BusinessResearchServiceTest {
    @Test
    void filtersOutGenericSectorStoriesForAnIndustrialHub() {
        String owner = "owner@example.test";
        UUID ideaId = UUID.randomUUID();
        BusinessIdea idea = mock(BusinessIdea.class);
        BusinessIdeaService ideas = mock(BusinessIdeaService.class);
        when(ideas.findIdea(owner, ideaId)).thenReturn(idea);
        when(idea.getName()).thenReturn("Dongo Kundu industrial hub");
        when(idea.getSectorGroup()).thenReturn("Manufacturing");

        RestClient.Builder clientBuilder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(clientBuilder).build();
        server.expect(requestTo("https://api.tavily.com/search"))
                .andExpect(content().string(containsString("Dongo Kundu industrial hub")))
                .andExpect(content().string(containsString("industrial hub")))
                .andRespond(withSuccess("""
                        {
                          "results": [
                            {
                              "title": "Sh90b to power Dongo Kundu industrial hub",
                              "url": "https://example.test/dongo-kundu",
                              "content": "Operators cite unreliable power, road access, land leasing and overlapping county permits."
                            },
                            {
                              "title": "MyGov supplier registration notice",
                              "url": "https://example.test/suppliers",
                              "content": "Suppliers invited to bid. Applications close next month."
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.tavily.com/search"))
                .andExpect(content().string(containsString("Dongo Kundu industrial hub")))
                .andExpect(content().string(containsString("reddit.com")))
                .andRespond(withSuccess("""
                        {
                          "results": [
                            {
                              "title": "r/Kenya: Industrial parks struggle with power and water",
                              "url": "https://reddit.com/r/Kenya/comments/industrial",
                              "content": "Operators discuss outages, water shortages and high county fees."
                            },
                            {
                              "title": "r/Kenya general business tax discussion",
                              "url": "https://reddit.com/r/Kenya/comments/general",
                              "content": "Owners discuss tax rates, crime and competition across many businesses."
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        BusinessResearchResponse response = new BusinessResearchService(
                ideas, clientBuilder, "test-key").research(owner, ideaId);

        assertThat(response.businessType()).isEqualTo("industrial hub");
        assertThat(response.keySignals()).contains(
                "Infrastructure and utility access",
                "Land, leases and permits",
                "Taxes and fees");
        assertThat(response.results()).extracting(BusinessResearchResponse.ResearchResult::url)
                .containsExactly(
                        "https://example.test/dongo-kundu",
                        "https://reddit.com/r/Kenya/comments/industrial");
        server.verify();
    }

    @Test
    void includesAnUnrecognizedBusinessNameInBothFocusedSearches() {
        String owner = "owner@example.test";
        UUID ideaId = UUID.randomUUID();
        BusinessIdea idea = mock(BusinessIdea.class);
        BusinessIdeaService ideas = mock(BusinessIdeaService.class);
        when(ideas.findIdea(owner, ideaId)).thenReturn(idea);
        when(idea.getName()).thenReturn("Nia's Phone Repair Shop");
        when(idea.getSectorGroup()).thenReturn("Personal services");
        when(idea.getLocation()).thenReturn("Kilimani");
        when(idea.getInitialCapitalKsh()).thenReturn(250000.0);

        RestClient.Builder clientBuilder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(clientBuilder).build();
        server.expect(requestTo("https://api.tavily.com/search"))
                .andExpect(content().string(containsString("Nia's Phone Repair Shop")))
                .andExpect(content().string(containsString("problems facing")))
                .andExpect(content().string(containsString("tax rates")))
                .andExpect(content().string(not(containsString("Kilimani"))))
                .andRespond(withSuccess("{\"results\":[]}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.tavily.com/search"))
                .andExpect(content().string(containsString("Nia's Phone Repair Shop")))
                .andExpect(content().string(containsString("reddit.com")))
                .andExpect(content().string(not(containsString("250000"))))
                .andRespond(withSuccess("{\"results\":[]}", MediaType.APPLICATION_JSON));

        BusinessResearchResponse response = new BusinessResearchService(
                ideas, clientBuilder, "test-key").research(owner, ideaId);

        assertThat(response.businessType()).isEqualTo("Personal services");
        assertThat(response.query()).contains("Nia's Phone Repair Shop");
        assertThat(response.results()).isEmpty();
        server.verify();
    }

    @Test
    void searchesBusinessNameAndIssueTopicsOnWebAndRedditAndFiltersIrrelevantResults() {
        String owner = "owner@example.test";
        UUID ideaId = UUID.randomUUID();
        BusinessIdea idea = mock(BusinessIdea.class);
        BusinessIdeaService ideas = mock(BusinessIdeaService.class);
        when(ideas.findIdea(owner, ideaId)).thenReturn(idea);
        when(idea.getName()).thenReturn("My Secret Butchery");
        when(idea.getSectorGroup()).thenReturn("Retail trade");
        when(idea.getLocation()).thenReturn("Westlands");
        when(idea.getInitialCapitalKsh()).thenReturn(300000.0);

        RestClient.Builder clientBuilder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(clientBuilder).build();
        server.expect(requestTo("https://api.tavily.com/search"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().string(containsString("butchery")))
                .andExpect(content().string(containsString("Kenya")))
                .andExpect(content().string(containsString("My Secret Butchery")))
                .andExpect(content().string(containsString("problems facing")))
                .andExpect(content().string(containsString("tax rates")))
                .andExpect(content().string(containsString("corruption")))
                .andExpect(content().string(containsString("competition")))
                .andExpect(content().string(containsString("\"country\":\"kenya\"")))
                .andExpect(content().string(not(containsString("Westlands"))))
                .andExpect(content().string(not(containsString("300000"))))
                .andRespond(withSuccess("""
                        {
                          "results": [
                            {
                              "title": "Kenya butchery faces meat safety inspections",
                              "url": "https://example.test/report",
                              "content": "Butcher shops report meat spoilage, hygiene inspections, refrigeration costs and changing beef prices.",
                              "published_date": "2026-10-12"
                            },
                            {
                              "title": "Nairobi tightens liquor store laws",
                              "url": "https://example.test/liquor",
                              "content": "Alcohol sales and liquor licensing rules are changing."
                            },
                            {
                              "title": "Kenya retail businesses face tax challenges",
                              "url": "https://example.test/retail",
                              "content": "Retail businesses discuss taxes, theft, corruption, and competition."
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.tavily.com/search"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(content().string(containsString("My Secret Butchery")))
                .andExpect(content().string(containsString("reddit.com")))
                .andExpect(content().string(containsString("\"country\":\"kenya\"")))
                .andExpect(content().string(not(containsString("Westlands"))))
                .andExpect(content().string(not(containsString("300000"))))
                .andRespond(withSuccess("""
                        {
                          "results": [
                            {
                              "title": "r/Kenya: Running a butchery in Nakuru",
                              "url": "https://reddit.com/r/Kenya/comments/example",
                              "content": "Owners discuss county taxes, theft, bribery and competition in the meat trade.",
                              "published_date": "2026-09-20"
                            }
                          ]
                        }
                        """, MediaType.APPLICATION_JSON));

        BusinessResearchService service = new BusinessResearchService(
                ideas, clientBuilder, "test-key");
        BusinessResearchResponse response = service.research(owner, ideaId);

        assertThat(response.sector()).isEqualTo("Retail trade");
        assertThat(response.geography()).isEqualTo("Kenya");
        assertThat(response.businessType()).isEqualTo("butchery");
        assertThat(response.keySignals()).contains(
                "Meat quality and food safety",
                "Cold storage and power",
                "Meat supply and prices",
                "Taxes and fees",
                "Crime and security",
                "Corruption and bribery",
                "Competition");
        assertThat(response.query()).contains("My Secret Butchery", "Reddit:");
        assertThat(response.results()).containsExactly(
                new BusinessResearchResponse.ResearchResult(
                        "Kenya butchery faces meat safety inspections",
                        "https://example.test/report",
                        "Butcher shops report meat spoilage, hygiene inspections, refrigeration costs and changing beef prices.",
                        "2026-10-12",
                        List.of("Meat quality and food safety", "Cold storage and power", "Meat supply and prices")),
                new BusinessResearchResponse.ResearchResult(
                        "r/Kenya: Running a butchery in Nakuru",
                        "https://reddit.com/r/Kenya/comments/example",
                        "Owners discuss county taxes, theft, bribery and competition in the meat trade.",
                        "2026-09-20",
                        List.of("Taxes and fees", "Crime and security", "Corruption and bribery", "Competition",
                                "Meat quality and food safety")));
        assertThat(response.retrievedAt()).isNotNull();
        server.verify();
    }
}
