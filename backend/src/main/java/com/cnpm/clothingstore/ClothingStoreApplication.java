package com.cnpm.clothingstore;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ClothingStoreApplication {
  public static void main(String[] args) { SpringApplication.run(ClothingStoreApplication.class, args); }
}
