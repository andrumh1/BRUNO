"""
Iteration 33: Modern Social Features Testing
Tests for: Trending hashtags, Suggested users, Bookmarks, Reactions, Reposts, 
Hashtag pages, Saved posts, Explore feed, Polls
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "newtest@bruno.com"
TEST_USER_PASSWORD = "Test1234!"
TEST_USER_ID = "b6a3059d-3c5c-4ffd-9fc2-b8dff4a420b9"

SECOND_USER_EMAIL = "testuser2@bruno.com"
SECOND_USER_PASSWORD = "Test1234!"
SECOND_USER_ID = "b6eb8b2a-1365-48de-9bde-9afd9677d4ba"


class TestAuth:
    """Authentication tests"""
    
    def test_login_primary_user(self):
        """Login with primary test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        print(f"✓ Primary user login successful: {data['user']['email']}")
        return data["access_token"]
    
    def test_login_secondary_user(self):
        """Login with secondary test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SECOND_USER_EMAIL,
            "password": SECOND_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        print(f"✓ Secondary user login successful: {data['user']['email']}")
        return data["access_token"]


class TestTrendingHashtags:
    """Tests for GET /api/social/trending"""
    
    def test_get_trending_no_auth(self):
        """Trending hashtags should work without auth"""
        response = requests.get(f"{BASE_URL}/api/social/trending")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Trending hashtags returned {len(data)} items")
        if data:
            assert "hashtag" in data[0], "Each item should have 'hashtag' field"
            print(f"  Sample: #{data[0]['hashtag']} ({data[0].get('count', 0)} posts)")
    
    def test_trending_with_limit(self):
        """Test trending with limit parameter"""
        response = requests.get(f"{BASE_URL}/api/social/trending?limit=5")
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 5, "Should respect limit parameter"
        print(f"✓ Trending with limit=5 returned {len(data)} items")


class TestSuggestedUsers:
    """Tests for GET /api/social/suggested"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_suggested_requires_auth(self):
        """Suggested users should require authentication"""
        response = requests.get(f"{BASE_URL}/api/social/suggested")
        assert response.status_code in [401, 403], "Should require auth"
        print("✓ Suggested users endpoint requires authentication")
    
    def test_suggested_with_auth(self, auth_token):
        """Get suggested users with authentication"""
        response = requests.get(
            f"{BASE_URL}/api/social/suggested",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Suggested users returned {len(data)} users")
        if data:
            assert "id" in data[0], "Each user should have 'id'"
            assert "name" in data[0] or "email" in data[0], "Each user should have name or email"


class TestBookmarks:
    """Tests for bookmark/save functionality"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def test_post_id(self, auth_token):
        """Create a test post and return its ID"""
        response = requests.post(
            f"{BASE_URL}/api/posts",
            json={"content": f"TEST_bookmark_test_{uuid.uuid4().hex[:8]} #testbookmark"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code == 201:
            return response.json()["id"]
        # Try to get an existing post
        posts_response = requests.get(f"{BASE_URL}/api/posts")
        if posts_response.status_code == 200 and posts_response.json():
            return posts_response.json()[0]["id"]
        pytest.skip("No posts available for testing")
    
    def test_toggle_bookmark_on(self, auth_token, test_post_id):
        """Toggle bookmark ON for a post"""
        response = requests.post(
            f"{BASE_URL}/api/posts/{test_post_id}/bookmark",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "bookmarked" in data, "Response should have 'bookmarked' field"
        print(f"✓ Bookmark toggled: bookmarked={data['bookmarked']}")
        return data["bookmarked"]
    
    def test_get_saved_posts(self, auth_token):
        """Get list of saved/bookmarked posts"""
        response = requests.get(
            f"{BASE_URL}/api/posts/saved/list",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Saved posts returned {len(data)} posts")
        if data:
            assert "id" in data[0], "Each post should have 'id'"
            assert data[0].get("is_bookmarked") == True, "Saved posts should have is_bookmarked=True"


class TestReactions:
    """Tests for multi-emoji reactions"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def test_post_id(self, auth_token):
        """Create a test post for reactions"""
        response = requests.post(
            f"{BASE_URL}/api/posts",
            json={"content": f"TEST_reaction_test_{uuid.uuid4().hex[:8]}"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code == 201:
            return response.json()["id"]
        posts_response = requests.get(f"{BASE_URL}/api/posts")
        if posts_response.status_code == 200 and posts_response.json():
            return posts_response.json()[0]["id"]
        pytest.skip("No posts available for testing")
    
    def test_add_like_reaction(self, auth_token, test_post_id):
        """Add 'like' reaction to a post"""
        response = requests.post(
            f"{BASE_URL}/api/posts/{test_post_id}/react?reaction_type=like",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "reacted" in data, "Response should have 'reacted' field"
        assert "reaction_type" in data, "Response should have 'reaction_type' field"
        print(f"✓ Like reaction: reacted={data['reacted']}, type={data['reaction_type']}")
    
    def test_add_love_reaction(self, auth_token, test_post_id):
        """Add 'love' reaction to a post"""
        response = requests.post(
            f"{BASE_URL}/api/posts/{test_post_id}/react?reaction_type=love",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        print(f"✓ Love reaction: reacted={data['reacted']}, type={data['reaction_type']}")
    
    def test_add_fire_reaction(self, auth_token, test_post_id):
        """Add 'fire' reaction to a post"""
        response = requests.post(
            f"{BASE_URL}/api/posts/{test_post_id}/react?reaction_type=fire",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        print(f"✓ Fire reaction toggled")
    
    def test_get_reactions(self, test_post_id):
        """Get reaction counts for a post"""
        response = requests.get(f"{BASE_URL}/api/posts/{test_post_id}/reactions")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, dict), "Response should be a dict of reaction counts"
        print(f"✓ Reactions for post: {data}")


class TestRepost:
    """Tests for repost/share functionality"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def test_post_id(self, auth_token):
        """Create a test post to repost"""
        response = requests.post(
            f"{BASE_URL}/api/posts",
            json={"content": f"TEST_original_post_{uuid.uuid4().hex[:8]}"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code == 201:
            return response.json()["id"]
        posts_response = requests.get(f"{BASE_URL}/api/posts")
        if posts_response.status_code == 200 and posts_response.json():
            return posts_response.json()[0]["id"]
        pytest.skip("No posts available for testing")
    
    def test_repost_without_quote(self, auth_token, test_post_id):
        """Repost a post without quote"""
        response = requests.post(
            f"{BASE_URL}/api/posts/{test_post_id}/repost",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "id" in data, "Repost should return new post with id"
        assert data.get("post_type") == "repost", "Post type should be 'repost'"
        print(f"✓ Repost created: {data['id']}")
    
    def test_repost_with_quote(self, auth_token, test_post_id):
        """Repost a post with quote text"""
        response = requests.post(
            f"{BASE_URL}/api/posts/{test_post_id}/repost?quote=Great%20post!",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("content") == "Great post!", "Quote should be in content"
        print(f"✓ Repost with quote created")


class TestHashtagPage:
    """Tests for GET /api/social/hashtag/{tag}"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_create_post_with_hashtag(self, auth_token):
        """Create a post with hashtag for testing"""
        response = requests.post(
            f"{BASE_URL}/api/posts",
            json={"content": f"TEST_hashtag_post_{uuid.uuid4().hex[:8]} #testhashtag #bruno"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code in [200, 201], f"Failed: {response.text}"
        data = response.json()
        assert "hashtags" in data, "Post should have hashtags field"
        print(f"✓ Post created with hashtags: {data.get('hashtags', [])}")
    
    def test_get_posts_by_hashtag_no_auth(self):
        """Get posts by hashtag without auth"""
        response = requests.get(f"{BASE_URL}/api/social/hashtag/bruno")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Hashtag #bruno returned {len(data)} posts")
    
    def test_get_posts_by_hashtag_with_auth(self, auth_token):
        """Get posts by hashtag with auth (includes is_bookmarked)"""
        response = requests.get(
            f"{BASE_URL}/api/social/hashtag/testhashtag",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        print(f"✓ Hashtag #testhashtag returned {len(data)} posts")
        if data:
            assert "is_bookmarked" in data[0], "Posts should include is_bookmarked when authenticated"
            assert "is_liked" in data[0], "Posts should include is_liked when authenticated"


class TestExploreFeed:
    """Tests for GET /api/social/explore"""
    
    def test_explore_trending(self):
        """Get explore feed - trending category"""
        response = requests.get(f"{BASE_URL}/api/social/explore?category=trending")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ Explore trending returned {len(data)} posts")
    
    def test_explore_recent(self):
        """Get explore feed - recent category"""
        response = requests.get(f"{BASE_URL}/api/social/explore?category=recent")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        print(f"✓ Explore recent returned {len(data)} posts")
    
    def test_explore_media(self):
        """Get explore feed - media category"""
        response = requests.get(f"{BASE_URL}/api/social/explore?category=media")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        print(f"✓ Explore media returned {len(data)} posts")
    
    def test_explore_cards(self):
        """Get explore feed - cards category"""
        response = requests.get(f"{BASE_URL}/api/social/explore?category=cards")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        print(f"✓ Explore cards returned {len(data)} posts")


class TestPolls:
    """Tests for polls functionality"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["access_token"]
    
    @pytest.fixture
    def second_auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SECOND_USER_EMAIL,
            "password": SECOND_USER_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_create_poll(self, auth_token):
        """Create a new poll"""
        response = requests.post(
            f"{BASE_URL}/api/social/polls",
            json={
                "question": "TEST_poll: What's your favorite color?",
                "options": ["Red", "Blue", "Green"],
                "duration_hours": 24
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "id" in data, "Poll should have id"
        assert "question" in data, "Poll should have question"
        assert "options" in data, "Poll should have options"
        assert len(data["options"]) == 3, "Poll should have 3 options"
        print(f"✓ Poll created: {data['id']}")
        return data["id"]
    
    def test_get_poll(self, auth_token):
        """Get poll details"""
        # First create a poll
        create_response = requests.post(
            f"{BASE_URL}/api/social/polls",
            json={
                "question": "TEST_poll_get: Best programming language?",
                "options": ["Python", "JavaScript", "Go"],
                "duration_hours": 24
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        poll_id = create_response.json()["id"]
        
        # Get the poll
        response = requests.get(f"{BASE_URL}/api/social/polls/{poll_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["id"] == poll_id
        assert "total_votes" in data
        print(f"✓ Poll retrieved: {data['question']}")
    
    def test_vote_on_poll(self, auth_token, second_auth_token):
        """Vote on a poll"""
        # Create poll with first user
        create_response = requests.post(
            f"{BASE_URL}/api/social/polls",
            json={
                "question": "TEST_poll_vote: Best framework?",
                "options": ["React", "Vue", "Angular"],
                "duration_hours": 24
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        poll_id = create_response.json()["id"]
        
        # Vote with second user
        response = requests.post(
            f"{BASE_URL}/api/social/polls/{poll_id}/vote",
            json={"option_index": 0},
            headers={"Authorization": f"Bearer {second_auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data["total_votes"] >= 1, "Total votes should be at least 1"
        assert data["options"][0]["votes"] >= 1, "Option 0 should have at least 1 vote"
        print(f"✓ Vote recorded: total_votes={data['total_votes']}")
    
    def test_cannot_vote_twice(self, auth_token):
        """User cannot vote twice on same poll"""
        # Create poll
        create_response = requests.post(
            f"{BASE_URL}/api/social/polls",
            json={
                "question": "TEST_poll_double: Favorite food?",
                "options": ["Pizza", "Burger", "Sushi"],
                "duration_hours": 24
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        poll_id = create_response.json()["id"]
        
        # First vote
        requests.post(
            f"{BASE_URL}/api/social/polls/{poll_id}/vote",
            json={"option_index": 0},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Second vote should fail
        response = requests.post(
            f"{BASE_URL}/api/social/polls/{poll_id}/vote",
            json={"option_index": 1},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 400, "Should not allow double voting"
        print("✓ Double voting correctly prevented")


class TestPostsWithBookmarkField:
    """Test that posts include is_bookmarked field in feed"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_posts_include_is_bookmarked(self, auth_token):
        """Posts in feed should include is_bookmarked field when authenticated"""
        response = requests.get(
            f"{BASE_URL}/api/posts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        if data:
            assert "is_bookmarked" in data[0], "Posts should include is_bookmarked field"
            print(f"✓ Posts include is_bookmarked field")
        else:
            print("⚠ No posts to verify is_bookmarked field")


class TestHashtagAutoExtraction:
    """Test that hashtags are auto-extracted from post content"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        return response.json()["access_token"]
    
    def test_hashtag_extraction(self, auth_token):
        """Post creation should auto-extract hashtags from content"""
        unique_tag = f"autotest{uuid.uuid4().hex[:6]}"
        response = requests.post(
            f"{BASE_URL}/api/posts",
            json={"content": f"Testing auto hashtag extraction #{unique_tag} #bruno #test"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code in [200, 201], f"Failed: {response.text}"
        data = response.json()
        assert "hashtags" in data, "Post should have hashtags field"
        hashtags_lower = [h.lower() for h in data["hashtags"]]
        assert unique_tag in hashtags_lower or unique_tag.lower() in hashtags_lower, f"Hashtag #{unique_tag} should be extracted"
        print(f"✓ Hashtags auto-extracted: {data['hashtags']}")


# Cleanup function
def cleanup_test_data():
    """Clean up TEST_ prefixed data after tests"""
    # This would be called in teardown if needed
    pass


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
