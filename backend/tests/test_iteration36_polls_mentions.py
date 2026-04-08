"""
Iteration 36: Tests for Polls, @Mentions, and Story Poll Integration
Features tested:
- Poll creation via POST /api/social/polls
- Poll voting via POST /api/social/polls/{poll_id}/vote
- Poll retrieval via GET /api/social/polls/{poll_id}
- Story creation with poll_id via POST /api/stories/
- Stories feed returns poll_id in story data
- @mention user search via GET /api/users/mention-search
- Post creation with @mentions (triggers notification)
- Comment creation with @mentions
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = os.getenv("TEST_USER_EMAIL", "newtest@bruno.com")
TEST_PASSWORD = os.getenv("TEST_USER_PASSWORD", "Test1234!")


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, f"No access_token in response: {data}"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def user_id(self, auth_token):
        """Get current user ID"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        return response.json()["id"]
    
    def test_login_returns_access_token(self):
        """Verify login returns access_token field"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 0


class TestPollEndpoints:
    """Poll CRUD tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    @pytest.fixture(scope="class")
    def created_poll_id(self, auth_token):
        """Create a poll and return its ID for other tests"""
        response = requests.post(f"{BASE_URL}/api/social/polls", json={
            "question": "TEST_Poll: What is your favorite color?",
            "options": ["Red", "Blue", "Green"],
            "duration_hours": 24
        }, headers={"Authorization": f"Bearer {auth_token}"})
        assert response.status_code == 200
        data = response.json()
        return data["id"]
    
    def test_create_poll(self, auth_token):
        """Test poll creation via POST /api/social/polls"""
        response = requests.post(f"{BASE_URL}/api/social/polls", json={
            "question": "TEST_Poll: Best programming language?",
            "options": ["Python", "JavaScript", "Go", "Rust"],
            "duration_hours": 12
        }, headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 200, f"Poll creation failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "id" in data
        assert data["question"] == "TEST_Poll: Best programming language?"
        assert len(data["options"]) == 4
        assert data["options"][0]["text"] == "Python"
        assert data["options"][0]["votes"] == 0
        assert "created_at" in data
        assert "expires_at" in data
        assert data["total_votes"] == 0
    
    def test_get_poll(self, auth_token, created_poll_id):
        """Test poll retrieval via GET /api/social/polls/{poll_id}"""
        response = requests.get(f"{BASE_URL}/api/social/polls/{created_poll_id}")
        
        assert response.status_code == 200, f"Get poll failed: {response.text}"
        data = response.json()
        
        assert data["id"] == created_poll_id
        assert "question" in data
        assert "options" in data
        assert isinstance(data["options"], list)
    
    def test_vote_on_poll(self, auth_token, created_poll_id):
        """Test voting on poll via POST /api/social/polls/{poll_id}/vote"""
        response = requests.post(f"{BASE_URL}/api/social/polls/{created_poll_id}/vote", json={
            "option_index": 0
        }, headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 200, f"Vote failed: {response.text}"
        data = response.json()
        
        # Verify vote was recorded
        assert data["options"][0]["votes"] >= 1
        assert data["total_votes"] >= 1
    
    def test_cannot_vote_twice(self, auth_token, created_poll_id):
        """Test that user cannot vote twice on same poll"""
        # First vote (may already be voted from previous test)
        requests.post(f"{BASE_URL}/api/social/polls/{created_poll_id}/vote", json={
            "option_index": 0
        }, headers={"Authorization": f"Bearer {auth_token}"})
        
        # Second vote should fail
        response = requests.post(f"{BASE_URL}/api/social/polls/{created_poll_id}/vote", json={
            "option_index": 1
        }, headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 400, f"Expected 400 for double vote, got {response.status_code}"
    
    def test_invalid_option_index(self, auth_token, created_poll_id):
        """Test voting with invalid option index"""
        # Create a new poll to vote on
        create_resp = requests.post(f"{BASE_URL}/api/social/polls", json={
            "question": "TEST_Poll: Invalid option test",
            "options": ["A", "B"],
            "duration_hours": 1
        }, headers={"Authorization": f"Bearer {auth_token}"})
        new_poll_id = create_resp.json()["id"]
        
        response = requests.post(f"{BASE_URL}/api/social/polls/{new_poll_id}/vote", json={
            "option_index": 99
        }, headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code == 400
    
    def test_get_nonexistent_poll(self):
        """Test getting a poll that doesn't exist"""
        response = requests.get(f"{BASE_URL}/api/social/polls/nonexistent-poll-id")
        assert response.status_code == 404


class TestStoryWithPoll:
    """Story creation with poll integration tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_create_story_with_poll(self, auth_token):
        """Test creating a story with poll_id attached"""
        # First create a poll
        poll_response = requests.post(f"{BASE_URL}/api/social/polls", json={
            "question": "TEST_Story_Poll: Favorite season?",
            "options": ["Spring", "Summer", "Fall", "Winter"],
            "duration_hours": 24
        }, headers={"Authorization": f"Bearer {auth_token}"})
        
        assert poll_response.status_code == 200
        poll_id = poll_response.json()["id"]
        
        # Create story with poll_id (note: trailing slash required)
        story_response = requests.post(f"{BASE_URL}/api/stories/", json={
            "media_url": "",
            "media_type": "poll",
            "caption": "Vote on my poll!",
            "visibility": "public",
            "duration": 15,
            "poll_id": poll_id
        }, headers={"Authorization": f"Bearer {auth_token}"})
        
        assert story_response.status_code == 200, f"Story creation failed: {story_response.text}"
        data = story_response.json()
        assert "id" in data
        assert "expires_at" in data
    
    def test_stories_feed_includes_poll_id(self, auth_token):
        """Test that stories feed returns poll_id in story data"""
        # Create a poll and story first
        poll_response = requests.post(f"{BASE_URL}/api/social/polls", json={
            "question": "TEST_Feed_Poll: Best food?",
            "options": ["Pizza", "Tacos", "Sushi"],
            "duration_hours": 24
        }, headers={"Authorization": f"Bearer {auth_token}"})
        poll_id = poll_response.json()["id"]
        
        # Create story with poll
        requests.post(f"{BASE_URL}/api/stories/", json={
            "media_url": "",
            "media_type": "poll",
            "caption": "Food poll",
            "visibility": "public",
            "poll_id": poll_id
        }, headers={"Authorization": f"Bearer {auth_token}"})
        
        # Get stories feed
        feed_response = requests.get(f"{BASE_URL}/api/stories/feed", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert feed_response.status_code == 200
        feed_data = feed_response.json()
        
        # Find our story with poll
        found_poll_story = False
        for user_stories in feed_data:
            for story in user_stories.get("stories", []):
                if story.get("poll_id") == poll_id:
                    found_poll_story = True
                    break
        
        assert found_poll_story, "Story with poll_id not found in feed"


class TestMentionSearch:
    """@mention user search tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_mention_search_endpoint(self, auth_token):
        """Test GET /api/users/mention-search returns users"""
        response = requests.get(f"{BASE_URL}/api/users/mention-search?q=test&limit=5", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200, f"Mention search failed: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list)
        
        # If results exist, validate structure
        if len(data) > 0:
            user = data[0]
            assert "id" in user
            assert "username" in user
    
    def test_mention_search_empty_query(self, auth_token):
        """Test mention search with empty query returns empty list"""
        response = requests.get(f"{BASE_URL}/api/users/mention-search?q=", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data == []
    
    def test_mention_search_requires_auth(self):
        """Test mention search requires authentication"""
        response = requests.get(f"{BASE_URL}/api/users/mention-search?q=test")
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"


class TestPostWithMentions:
    """Post creation with @mentions tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_create_post_with_mention(self, auth_token):
        """Test creating a post with @mention"""
        response = requests.post(f"{BASE_URL}/api/posts", json={
            "content": "TEST_Post: Hello @testuser! Check this out #testing",
            "visibility": "public",
            "hashtags": ["testing"]
        }, headers={"Authorization": f"Bearer {auth_token}"})
        
        assert response.status_code in [200, 201], f"Post creation failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert "@testuser" in data.get("content", "")
    
    def test_create_comment_with_mention(self, auth_token):
        """Test creating a comment with @mention"""
        # First create a post
        post_response = requests.post(f"{BASE_URL}/api/posts", json={
            "content": "TEST_Post: Comment test post",
            "visibility": "public"
        }, headers={"Authorization": f"Bearer {auth_token}"})
        
        post_id = post_response.json()["id"]
        
        # Create comment with mention
        comment_response = requests.post(f"{BASE_URL}/api/posts/{post_id}/comments", json={
            "content": "TEST_Comment: Great post @someone!"
        }, headers={"Authorization": f"Bearer {auth_token}"})
        
        assert comment_response.status_code in [200, 201], f"Comment creation failed: {comment_response.text}"
        data = comment_response.json()
        
        assert "id" in data
        assert "@someone" in data.get("content", "")


class TestHashtagEndpoints:
    """Hashtag-related endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_get_posts_by_hashtag(self, auth_token):
        """Test GET /api/social/hashtag/{tag}"""
        # First create a post with hashtag
        requests.post(f"{BASE_URL}/api/posts", json={
            "content": "TEST_Post: Testing hashtags #testhashtag36",
            "visibility": "public",
            "hashtags": ["testhashtag36"]
        }, headers={"Authorization": f"Bearer {auth_token}"})
        
        # Get posts by hashtag
        response = requests.get(f"{BASE_URL}/api/social/hashtag/testhashtag36", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_trending_hashtags(self, auth_token):
        """Test GET /api/social/trending"""
        response = requests.get(f"{BASE_URL}/api/social/trending", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestReactionsEndpoint:
    """Post reactions endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_react_to_post(self, auth_token):
        """Test POST /api/posts/{post_id}/react"""
        # Create a post first
        post_response = requests.post(f"{BASE_URL}/api/posts", json={
            "content": "TEST_Post: Reaction test",
            "visibility": "public"
        }, headers={"Authorization": f"Bearer {auth_token}"})
        
        post_id = post_response.json()["id"]
        
        # React to post
        reaction_response = requests.post(
            f"{BASE_URL}/api/posts/{post_id}/react?reaction_type=love",
            json={},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert reaction_response.status_code == 200, f"Reaction failed: {reaction_response.text}"
        data = reaction_response.json()
        assert "reacted" in data


class TestBookmarkEndpoint:
    """Bookmark endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_bookmark_post(self, auth_token):
        """Test POST /api/posts/{post_id}/bookmark"""
        # Create a post first
        post_response = requests.post(f"{BASE_URL}/api/posts", json={
            "content": "TEST_Post: Bookmark test",
            "visibility": "public"
        }, headers={"Authorization": f"Bearer {auth_token}"})
        
        post_id = post_response.json()["id"]
        
        # Bookmark post
        bookmark_response = requests.post(
            f"{BASE_URL}/api/posts/{post_id}/bookmark",
            json={},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert bookmark_response.status_code == 200, f"Bookmark failed: {bookmark_response.text}"
        data = bookmark_response.json()
        assert "bookmarked" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
