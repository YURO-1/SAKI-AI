package ke.saki.backend.analysis;

import java.time.Instant;
import java.util.UUID;

import tools.jackson.databind.JsonNode;

public record AnalysisResponse(UUID id, UUID ideaId, Instant createdAt, JsonNode result) {
}
