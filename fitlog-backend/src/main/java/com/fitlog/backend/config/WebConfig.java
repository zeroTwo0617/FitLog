package com.fitlog.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import com.fitlog.backend.service.JwtService;

/**
 * 跨域：小程序的 wx.request 同源策略宽松，但浏览器联调 / 未来 Web 端需要 CORS。
 * 生产环境可改为具体域名白名单。
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {
    private final JwtService jwtService;

    public WebConfig(JwtService jwtService, @Value("${fitlog.auth.admin-openids:}") String adminOpenids) {
        this.jwtService = jwtService;
        this.adminOpenids = adminOpenids;
    }
    private final String adminOpenids;

    @Override
    public void addInterceptors(org.springframework.web.servlet.config.annotation.InterceptorRegistry registry) {
        registry.addInterceptor(new AuthInterceptor(jwtService, adminOpenids))
                .addPathPatterns("/api/agent/**", "/api/admin/**");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
