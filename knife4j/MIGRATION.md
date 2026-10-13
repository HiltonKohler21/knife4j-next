# Migration

This fork keeps the same artifact names as upstream `knife4j`, but publishes them under the `com.baizhukui` namespace.

## Coordinates

Replace:

```xml
<dependency>
  <groupId>com.github.xiaoymin</groupId>
  <artifactId>knife4j-openapi3-spring-boot-starter</artifactId>
  <version>4.5.0</version>
</dependency>
```

With:

```xml
<dependency>
  <groupId>com.baizhukui</groupId>
  <artifactId>knife4j-openapi3-spring-boot-starter</artifactId>
  <version>5.7.8</version>
</dependency>
```

## Compatibility

- Java package names remain `com.github.xiaoymin.knife4j.*` in the first fork release.
- Spring configuration and `doc.html` access patterns are unchanged.
- The first fork release is intended to be a drop-in dependency replacement.

- In `5.7.8`, Boot3 Jakarta MVC, WebFlux and standalone aggregation use springdoc `2.9.1` and require Boot `3.4.7+` / `3.5.1+` (Framework `6.2.8`). Gateway modules retain their existing Cloud/Boot combinations.
