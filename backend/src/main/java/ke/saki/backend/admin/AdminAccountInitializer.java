package ke.saki.backend.admin;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;

import ke.saki.backend.user.UserAccount;
import ke.saki.backend.user.UserAccountRepository;
import ke.saki.backend.user.UserRole;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class AdminAccountInitializer implements ApplicationRunner {
    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;
    private final String adminEmail;
    private final String adminPassword;

    public AdminAccountInitializer(
            UserAccountRepository users,
            PasswordEncoder passwordEncoder,
            @Value("${saki.admin.email:}") String adminEmail,
            @Value("${saki.admin.password:}") String adminPassword) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.adminEmail = adminEmail;
        this.adminPassword = adminPassword;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (adminEmail.isBlank() && adminPassword.isBlank()) {
            return;
        }
        if (adminEmail.isBlank() || adminPassword.isBlank()) {
            throw new IllegalStateException("Both SAKI_ADMIN_EMAIL and SAKI_ADMIN_PASSWORD must be configured together.");
        }
        if (adminPassword.length() < 12
                || adminPassword.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalStateException("SAKI_ADMIN_PASSWORD must be at least 12 characters and at most 72 UTF-8 bytes.");
        }

        String normalizedEmail = adminEmail.trim().toLowerCase(Locale.ROOT);
        Optional<UserAccount> existing = users.findByEmail(normalizedEmail);
        if (existing.isPresent()) {
            if (existing.get().getRole() != UserRole.ADMIN) {
                throw new IllegalStateException(
                        "The configured administrator email already belongs to a non-admin account.");
            }
            return;
        }

        users.save(new UserAccount(
                normalizedEmail,
                passwordEncoder.encode(adminPassword),
                UserRole.ADMIN));
    }
}
