package ke.saki.backend.analysis;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ideas/{ideaId}/analyses")
public class AnalysisController {
    private final AnalysisService service;

    public AnalysisController(AnalysisService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AnalysisResponse analyze(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID ideaId) {
        return service.analyze(jwt.getSubject(), ideaId);
    }

    @GetMapping
    public List<AnalysisResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID ideaId) {
        return service.list(jwt.getSubject(), ideaId);
    }
}
