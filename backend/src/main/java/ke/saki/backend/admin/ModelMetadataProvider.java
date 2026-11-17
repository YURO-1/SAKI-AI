package ke.saki.backend.admin;

import tools.jackson.databind.JsonNode;

public interface ModelMetadataProvider {
    JsonNode getCurrentModel();
}
