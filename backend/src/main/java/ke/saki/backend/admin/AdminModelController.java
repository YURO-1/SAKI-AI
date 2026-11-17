package ke.saki.backend.admin;

import tools.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/model")
public class AdminModelController {
    private final ModelMetadataProvider modelMetadata;

    public AdminModelController(ModelMetadataProvider modelMetadata) {
        this.modelMetadata = modelMetadata;
    }

    @GetMapping
    public JsonNode currentModel() {
        return modelMetadata.getCurrentModel();
    }
}
