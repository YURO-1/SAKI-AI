package ke.saki.backend.analysis;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import ke.saki.backend.idea.BusinessIdea;
import ke.saki.backend.idea.BusinessIdeaService;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class AnalysisService {
    private final BusinessIdeaService ideaService;
    private final BusinessAnalysisRepository analyses;
    private final RestClient mlClient;
    private final ObjectMapper objectMapper;

    public AnalysisService(
            BusinessIdeaService ideaService,
            BusinessAnalysisRepository analyses,
            ObjectMapper objectMapper,
            @Value("${saki.ml-service.base-url}") String mlServiceUrl) {
        this.ideaService = ideaService;
        this.analyses = analyses;
        this.mlClient = RestClient.builder().baseUrl(mlServiceUrl).build();
        this.objectMapper = objectMapper;
    }

    public AnalysisResponse analyze(String email, UUID ideaId) {
        BusinessIdea idea = ideaService.findIdea(email, ideaId);
        try {
            Map<String, Object> predictionInput = Map.of(
                    "sector_group", idea.getSectorGroup(),
                    "premises_group", idea.getPremisesGroup(),
                    "registered", idea.isRegistered() ? 1 : 0,
                    "main_buyer_code", idea.getMainBuyerCode(),
                    "capital_source_code", idea.getCapitalSourceCode(),
                    "initial_capital_ksh", idea.getInitialCapitalKsh(),
                    "founding_employees", idea.getFoundingEmployees());
            JsonNode prediction = mlClient.post()
                    .uri("/predict/revenue-tier")
                    .body(predictionInput)
                    .retrieve()
                    .body(JsonNode.class);
            JsonNode constraints = mlClient.get()
                    .uri(uri -> uri.path("/constraints")
                            .queryParam("scope", "Nairobi")
                            .queryParam("sector", idea.getSectorGroup())
                            .build())
                    .retrieve()
                    .body(JsonNode.class);
            JsonNode benchmark = mlClient.get()
                    .uri(uri -> uri.path("/benchmarks")
                            .queryParam("sector", idea.getSectorGroup())
                            .build())
                    .retrieve()
                    .body(JsonNode.class);

            Map<String, Object> result = Map.of(
                    "revenuePrediction", prediction,
                    "constraints", constraints,
                    "benchmark", benchmark,
                    "assessmentNotes", List.of(
                            "Revenue tier is a historical comparison, not a probability of success.",
                            "WBES constraints are sector-level evidence and may use national fallback data.",
                            "No overall success score is calculated."));
            String json = objectMapper.writeValueAsString(result);
            BusinessAnalysis saved = analyses.save(new BusinessAnalysis(idea, json));
            return response(saved);
        } catch (RestClientException exception) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "The ML and evidence service is unavailable or returned an error.",
                    exception);
        } catch (JacksonException exception) {
            throw new IllegalStateException("Could not serialize the analysis result.", exception);
        }
    }

    @Transactional(readOnly = true)
    public List<AnalysisResponse> list(String email, UUID ideaId) {
        BusinessIdea idea = ideaService.findIdea(email, ideaId);
        return analyses.findAllByBusinessIdeaIdOrderByCreatedAtDesc(idea.getId())
                .stream().map(this::response).toList();
    }

    private AnalysisResponse response(BusinessAnalysis analysis) {
        try {
            return new AnalysisResponse(
                    analysis.getId(),
                    analysis.getBusinessIdea().getId(),
                    analysis.getCreatedAt(),
                    objectMapper.readTree(analysis.getResultJson()));
        } catch (JacksonException exception) {
            throw new IllegalStateException("Stored analysis result is invalid JSON.", exception);
        }
    }
}
