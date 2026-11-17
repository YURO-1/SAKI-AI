package ke.saki.backend.admin;

import tools.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MlModelMetadataProvider implements ModelMetadataProvider {
    private final RestClient mlClient;

    public MlModelMetadataProvider(@Value("${saki.ml-service.base-url}") String mlServiceUrl) {
        this.mlClient = RestClient.builder().baseUrl(mlServiceUrl).build();
    }

    @Override
    public JsonNode getCurrentModel() {
        try {
            JsonNode metadata = mlClient.get()
                    .uri("/metadata")
                    .retrieve()
                    .body(JsonNode.class);
            if (metadata == null) {
                throw new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "The ML service returned empty model metadata.");
            }
            return metadata;
        } catch (RestClientException exception) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Model metadata is unavailable from the ML service.",
                    exception);
        }
    }
}
