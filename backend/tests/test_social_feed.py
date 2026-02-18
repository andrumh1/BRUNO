"""
Test suite for BRUNO Social Feed Feature
Tests: Posts CRUD, Likes, Comments
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """Test API is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("✓ API health check passed")


class TestAuthentication:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "newtest@bruno.com",
            "password": "Test1234!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"✓ Login successful for user: {data['user'].get('email')}")
        return data["access_token"]


class TestPostsAPI:
    """Posts API tests - GET, POST, DELETE"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "newtest@bruno.com",
            "password": "Test1234!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_posts_public(self):
        """Test getting posts without authentication (public feed)"""
        response = requests.get(f"{BASE_URL}/api/posts")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/posts returned {len(data)} posts")
        
        # Verify post structure if posts exist
        if len(data) > 0:
            post = data[0]
            assert "id" in post
            assert "content" in post
            assert "user_id" in post
            assert "likes_count" in post
            assert "comments_count" in post
            assert "user" in post
            assert "username" in post["user"]
            print(f"✓ Post structure verified: id={post['id'][:8]}...")
    
    def test_get_posts_authenticated(self, auth_token):
        """Test getting posts with authentication (includes is_liked status)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/posts", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data) > 0:
            post = data[0]
            assert "is_liked" in post
            print(f"✓ Authenticated GET /api/posts includes is_liked field")
    
    def test_create_post(self, auth_token):
        """Test creating a new post"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        test_content = f"TEST_Post created at {int(time.time())}"
        
        response = requests.post(f"{BASE_URL}/api/posts", 
            headers=headers,
            json={
                "content": test_content,
                "post_type": "text",
                "visibility": "public",
                "hashtags": ["test", "bruno"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["content"] == test_content
        assert data["post_type"] == "text"
        print(f"✓ POST /api/posts created post: {data['id'][:8]}...")
        return data["id"]
    
    def test_create_and_verify_post_persistence(self, auth_token):
        """Test that created post appears in feed"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        test_content = f"TEST_Persistence check {int(time.time())}"
        
        # Create post
        create_response = requests.post(f"{BASE_URL}/api/posts",
            headers=headers,
            json={
                "content": test_content,
                "post_type": "text",
                "visibility": "public"
            }
        )
        assert create_response.status_code == 200
        post_id = create_response.json()["id"]
        
        # Verify post appears in feed
        get_response = requests.get(f"{BASE_URL}/api/posts", headers=headers)
        assert get_response.status_code == 200
        posts = get_response.json()
        
        found = any(p["id"] == post_id for p in posts)
        assert found, "Created post not found in feed"
        print(f"✓ Created post {post_id[:8]}... verified in feed")
        
        # Cleanup - delete the test post
        delete_response = requests.delete(f"{BASE_URL}/api/posts/{post_id}", headers=headers)
        assert delete_response.status_code == 200
        print(f"✓ Test post deleted")
    
    def test_get_single_post(self, auth_token):
        """Test getting a single post by ID"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First get posts to find an ID
        response = requests.get(f"{BASE_URL}/api/posts", headers=headers)
        posts = response.json()
        
        if len(posts) == 0:
            pytest.skip("No posts available to test")
        
        post_id = posts[0]["id"]
        
        # Get single post
        response = requests.get(f"{BASE_URL}/api/posts/{post_id}", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == post_id
        print(f"✓ GET /api/posts/{post_id[:8]}... returned correct post")
    
    def test_delete_post(self, auth_token):
        """Test deleting a post"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create a post to delete
        create_response = requests.post(f"{BASE_URL}/api/posts",
            headers=headers,
            json={
                "content": f"TEST_Delete me {int(time.time())}",
                "post_type": "text",
                "visibility": "public"
            }
        )
        assert create_response.status_code == 200
        post_id = create_response.json()["id"]
        
        # Delete the post
        delete_response = requests.delete(f"{BASE_URL}/api/posts/{post_id}", headers=headers)
        assert delete_response.status_code == 200
        
        # Verify post is deleted
        get_response = requests.get(f"{BASE_URL}/api/posts/{post_id}", headers=headers)
        assert get_response.status_code == 404
        print(f"✓ DELETE /api/posts/{post_id[:8]}... successful")


class TestLikesAPI:
    """Likes API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "newtest@bruno.com",
            "password": "Test1234!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_like_post(self, auth_token):
        """Test liking a post"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get a post to like
        response = requests.get(f"{BASE_URL}/api/posts", headers=headers)
        posts = response.json()
        
        if len(posts) == 0:
            pytest.skip("No posts available to test")
        
        post_id = posts[0]["id"]
        initial_likes = posts[0]["likes_count"]
        initial_is_liked = posts[0].get("is_liked", False)
        
        # Toggle like
        like_response = requests.post(f"{BASE_URL}/api/posts/{post_id}/like", headers=headers)
        assert like_response.status_code == 200
        data = like_response.json()
        
        assert "liked" in data
        assert "likes_count" in data
        
        if initial_is_liked:
            # Was liked, now unliked
            assert data["liked"] == False
            assert data["likes_count"] == initial_likes - 1
            print(f"✓ POST /api/posts/{post_id[:8]}.../like - unliked (count: {data['likes_count']})")
        else:
            # Was not liked, now liked
            assert data["liked"] == True
            assert data["likes_count"] == initial_likes + 1
            print(f"✓ POST /api/posts/{post_id[:8]}.../like - liked (count: {data['likes_count']})")
    
    def test_like_toggle(self, auth_token):
        """Test that like toggles correctly"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create a fresh post to test
        create_response = requests.post(f"{BASE_URL}/api/posts",
            headers=headers,
            json={
                "content": f"TEST_Like toggle test {int(time.time())}",
                "post_type": "text",
                "visibility": "public"
            }
        )
        post_id = create_response.json()["id"]
        
        # Like the post
        like1 = requests.post(f"{BASE_URL}/api/posts/{post_id}/like", headers=headers)
        assert like1.json()["liked"] == True
        assert like1.json()["likes_count"] == 1
        
        # Unlike the post
        like2 = requests.post(f"{BASE_URL}/api/posts/{post_id}/like", headers=headers)
        assert like2.json()["liked"] == False
        assert like2.json()["likes_count"] == 0
        
        # Like again
        like3 = requests.post(f"{BASE_URL}/api/posts/{post_id}/like", headers=headers)
        assert like3.json()["liked"] == True
        assert like3.json()["likes_count"] == 1
        
        print(f"✓ Like toggle works correctly: True -> False -> True")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/posts/{post_id}", headers=headers)


class TestCommentsAPI:
    """Comments API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "newtest@bruno.com",
            "password": "Test1234!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_comments(self, auth_token):
        """Test getting comments for a post"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get a post
        response = requests.get(f"{BASE_URL}/api/posts", headers=headers)
        posts = response.json()
        
        if len(posts) == 0:
            pytest.skip("No posts available to test")
        
        post_id = posts[0]["id"]
        
        # Get comments
        comments_response = requests.get(f"{BASE_URL}/api/posts/{post_id}/comments")
        assert comments_response.status_code == 200
        data = comments_response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/posts/{post_id[:8]}.../comments returned {len(data)} comments")
    
    def test_create_comment(self, auth_token):
        """Test creating a comment on a post"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create a post to comment on
        create_post = requests.post(f"{BASE_URL}/api/posts",
            headers=headers,
            json={
                "content": f"TEST_Comment test post {int(time.time())}",
                "post_type": "text",
                "visibility": "public"
            }
        )
        post_id = create_post.json()["id"]
        
        # Create comment
        comment_content = f"TEST_Comment {int(time.time())}"
        comment_response = requests.post(f"{BASE_URL}/api/posts/{post_id}/comments",
            headers=headers,
            json={"content": comment_content}
        )
        assert comment_response.status_code == 200
        data = comment_response.json()
        
        assert "id" in data
        assert data["content"] == comment_content
        assert "user" in data
        print(f"✓ POST /api/posts/{post_id[:8]}.../comments created comment")
        
        # Verify comment appears in list
        get_comments = requests.get(f"{BASE_URL}/api/posts/{post_id}/comments")
        comments = get_comments.json()
        found = any(c["id"] == data["id"] for c in comments)
        assert found, "Created comment not found in comments list"
        print(f"✓ Comment verified in comments list")
        
        # Verify post's comment count increased
        get_post = requests.get(f"{BASE_URL}/api/posts/{post_id}", headers=headers)
        assert get_post.json()["comments_count"] == 1
        print(f"✓ Post comments_count updated to 1")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/posts/{post_id}", headers=headers)


class TestPostsWithMedia:
    """Test posts with media attachments"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "newtest@bruno.com",
            "password": "Test1234!"
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_create_post_with_media(self, auth_token):
        """Test creating a post with media (image URL)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(f"{BASE_URL}/api/posts",
            headers=headers,
            json={
                "content": f"TEST_Post with media {int(time.time())}",
                "post_type": "image",
                "visibility": "public",
                "media": [
                    {"type": "image", "url": "https://via.placeholder.com/400"}
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["post_type"] == "image"
        assert len(data["media"]) == 1
        print(f"✓ Created post with media attachment")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/posts/{data['id']}", headers=headers)


class TestUnauthorizedAccess:
    """Test unauthorized access to protected endpoints"""
    
    def test_create_post_unauthorized(self):
        """Test creating post without auth fails"""
        response = requests.post(f"{BASE_URL}/api/posts",
            json={
                "content": "Should fail",
                "post_type": "text",
                "visibility": "public"
            }
        )
        assert response.status_code in [401, 403]
        print(f"✓ POST /api/posts without auth returns {response.status_code}")
    
    def test_like_post_unauthorized(self):
        """Test liking post without auth fails"""
        # Get a post ID first
        posts = requests.get(f"{BASE_URL}/api/posts").json()
        if len(posts) == 0:
            pytest.skip("No posts available")
        
        post_id = posts[0]["id"]
        response = requests.post(f"{BASE_URL}/api/posts/{post_id}/like")
        assert response.status_code in [401, 403]
        print(f"✓ POST /api/posts/{post_id[:8]}.../like without auth returns {response.status_code}")
    
    def test_comment_unauthorized(self):
        """Test commenting without auth fails"""
        posts = requests.get(f"{BASE_URL}/api/posts").json()
        if len(posts) == 0:
            pytest.skip("No posts available")
        
        post_id = posts[0]["id"]
        response = requests.post(f"{BASE_URL}/api/posts/{post_id}/comments",
            json={"content": "Should fail"}
        )
        assert response.status_code in [401, 403]
        print(f"✓ POST /api/posts/{post_id[:8]}.../comments without auth returns {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
