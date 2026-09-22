package com.phyok.mybatis;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Configuration;

@Configuration
@MapperScan(basePackages = "com.phyok")
public class MybatisModuleConfiguration {
}
