package com.fitlog.backend.service;

import com.fitlog.backend.model.entity.ExerciseMedia;
import com.fitlog.backend.repository.ExerciseMediaMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.stream.Stream;

/**
 * 启动钩子：
 * 1) 若占位图缺失，用 BufferedImage 生成 “暂无图片 / No image yet” PNG（不依赖外部字体资源）。
 * 2) 扫描 media.dir/exercises 下的 GIF，自动写入 exercises_media（INSERT IGNORE，幂等）。
 *    这样“把图片放进后端 / 换掉 Gymvisual 数据”只需替换文件夹里文件，重启即生效。
 */
@Component
public class MediaBootstrap implements CommandLineRunner {

    private final String mediaDir;
    private final String placeholderRel;
    private final ExerciseMediaMapper mapper;

    public MediaBootstrap(@Value("${fitlog.media.dir:./media}") String mediaDir,
                          @Value("${fitlog.media.placeholder:/media/placeholder/exercise-missing.png}") String placeholder,
                          ExerciseMediaMapper mapper) {
        this.mediaDir = mediaDir;
        this.placeholderRel = placeholder.startsWith("/media/") ? placeholder.substring("/media/".length()) : placeholder;
        this.mapper = mapper;
    }

    @Override
    public void run(String... args) {
        generatePlaceholderIfMissing();
        seedFromDisk();
    }

    private void generatePlaceholderIfMissing() {
        Path dir = Paths.get(mediaDir, "placeholder").toAbsolutePath().normalize();
        dir.toFile().mkdirs();
        Path file = dir.resolve("exercise-missing.png");
        if (Files.exists(file)) return;
        int w = 360, h = 240;
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(new Color(0x17, 0x1a, 0x21));
        g.fillRect(0, 0, w, h);
        g.setColor(new Color(0x2a, 0x2f, 0x3a));
        g.fillRoundRect(18, 18, w - 36, h - 36, 18, 18);
        g.setColor(new Color(0x8a, 0x93, 0xa3));
        g.setFont(new Font("SansSerif", Font.BOLD, 30));
        FontMetrics fm = g.getFontMetrics();
        String t1 = "暂无图片";
        g.drawString(t1, (w - fm.stringWidth(t1)) / 2, h / 2 - 4);
        g.setFont(new Font("SansSerif", Font.PLAIN, 15));
        fm = g.getFontMetrics();
        String t2 = "No image yet";
        g.drawString(t2, (w - fm.stringWidth(t2)) / 2, h / 2 + 26);
        g.dispose();
        try (OutputStream os = Files.newOutputStream(file)) {
            ImageIO.write(img, "PNG", os);
            System.out.println("[MediaBootstrap] 已生成占位图: " + file);
        } catch (IOException e) {
            System.err.println("[MediaBootstrap] 生成占位图失败: " + e.getMessage());
        }
    }

    private void seedFromDisk() {
        Path dir = Paths.get(mediaDir, "exercises").toAbsolutePath().normalize();
        if (!Files.isDirectory(dir)) {
            System.out.println("[MediaBootstrap] 未找到图片目录: " + dir + "（跳过种子，放入 GIF 后重启即可）");
            return;
        }
        try (Stream<Path> s = Files.list(dir)) {
            s.filter(p -> p.getFileName().toString().toLowerCase().endsWith(".gif"))
              .filter(Files::isRegularFile)
              .forEach(p -> {
                  String name = p.getFileName().toString();
                  String id = name.substring(0, name.lastIndexOf('.'));
                  if (id.isBlank() || id.contains("/") || id.contains("\\") || id.contains("..")) {
                      System.err.println("[MediaBootstrap] 跳过非法文件名: " + name);
                      return;
                  }
                  ExerciseMedia em = new ExerciseMedia();
                  em.setExerciseId(id);
                  em.setMediaType("gif");
                  em.setStorageKey("exercises/" + name);
                  try {
                      mapper.insertIgnore(em);
                  } catch (Exception e) {
                      // 打印完整异常链，避免深层 cause 被吞（如 JDBC 连接/编码类错误）
                      System.err.println("[MediaBootstrap] 写入 " + id + " 失败: " + e.getClass().getSimpleName());
                      Throwable c = e;
                      while (c != null) {
                          System.err.println("    Caused by: " + c.getClass().getName()
                                  + (c.getMessage() != null ? ": " + c.getMessage() : ""));
                          c = c.getCause();
                      }
                  }
              });
            System.out.println("[MediaBootstrap] 图片种子完成，目录: " + dir);
        } catch (IOException e) {
            System.err.println("[MediaBootstrap] 扫描图片目录失败: " + e.getMessage());
        }
    }
}
