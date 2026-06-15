package com.ainote.server.memo;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import java.time.Instant;

@Entity
public class Memo {

    @Id
    private String id;

    private String title;

    @Lob
    private String body;

    private boolean favorite;

    private String category;

    private String color;

    private Instant createdAt;

    private Instant updatedAt;

    protected Memo() {
    }

    public Memo(String id, String title, String body, boolean favorite, String category, String color,
            Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.title = title;
        this.body = body;
        this.favorite = favorite;
        this.category = category;
        this.color = color;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public boolean isFavorite() {
        return favorite;
    }

    public void setFavorite(boolean favorite) {
        this.favorite = favorite;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
