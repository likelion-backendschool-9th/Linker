FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /app

COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN chmod +x gradlew
COPY src ./src
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon bootJar

FROM eclipse-temurin:21-jre-jammy AS runtime
WORKDIR /app
RUN groupadd --gid 10001 linker && useradd --uid 10001 --gid linker linker
COPY --from=build --chown=linker:linker /app/build/libs/*.jar ./app.jar
USER linker
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
