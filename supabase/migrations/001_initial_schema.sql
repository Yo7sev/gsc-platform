-- ============================================
-- GSC Platform Database Schema
-- ============================================

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom Types
CREATE TYPE user_role AS ENUM ('admin', 'player', 'organizer');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE match_status AS ENUM ('open', 'full', 'in_progress', 'completed', 'cancelled');
CREATE TYPE formation_type AS ENUM ('position_based', 'general_list');
CREATE TYPE booking_status AS ENUM ('confirmed', 'attended', 'no_show', 'cancelled');
CREATE TYPE coin_transaction_type AS ENUM ('reward', 'purchase', 'redemption', 'adjustment');
CREATE TYPE dispute_status AS ENUM ('open', 'under_review', 'resolved', 'escalated');

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    bio TEXT,
    role user_role NOT NULL DEFAULT 'player',
    verification_status verification_status NOT NULL DEFAULT 'pending',
    coin_balance INTEGER NOT NULL DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    is_suspended BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_verification ON profiles(verification_status);

-- ============================================
-- MATCHES TABLE
-- ============================================
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizer_id UUID NOT NULL REFERENCES profiles(id),
    title TEXT NOT NULL,
    description TEXT,
    location TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    match_format TEXT NOT NULL,
    formation_type formation_type NOT NULL DEFAULT 'general_list',
    formation_layout JSONB,
    price DECIMAL(10,2) DEFAULT 0,
    pitch_features JSONB DEFAULT '[]',
    scheduled_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 90,
    max_players INTEGER NOT NULL,
    current_players INTEGER DEFAULT 0,
    status match_status NOT NULL DEFAULT 'open',
    coin_reward INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_matches_organizer ON matches(organizer_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_date ON matches(scheduled_date);

-- ============================================
-- MATCH POSITIONS TABLE
-- ============================================
CREATE TABLE match_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    position_name TEXT NOT NULL,
    position_label TEXT,
    position_x INTEGER NOT NULL,
    position_y INTEGER NOT NULL,
    player_id UUID REFERENCES profiles(id),
    status TEXT NOT NULL DEFAULT 'available',
    booked_at TIMESTAMPTZ
);

CREATE INDEX idx_positions_match ON match_positions(match_id);

-- ============================================
-- MATCH BOOKINGS TABLE
-- ============================================
CREATE TABLE match_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES profiles(id),
    position_id UUID REFERENCES match_positions(id),
    booking_type TEXT NOT NULL DEFAULT 'general',
    status booking_status NOT NULL DEFAULT 'confirmed',
    booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_match ON match_bookings(match_id);
CREATE INDEX idx_bookings_player ON match_bookings(player_id);

-- ============================================
-- VERIFICATIONS TABLE
-- ============================================
CREATE TABLE verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    document_type TEXT NOT NULL,
    document_url TEXT NOT NULL,
    document_number TEXT,
    status verification_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verifications_status ON verifications(status);

-- ============================================
-- RATINGS TABLE
-- ============================================
CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id),
    from_user_id UUID NOT NULL REFERENCES profiles(id),
    to_user_id UUID NOT NULL REFERENCES profiles(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    rating_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ratings_match ON ratings(match_id);
CREATE INDEX idx_ratings_to_user ON ratings(to_user_id);

-- ============================================
-- COIN TRANSACTIONS TABLE
-- ============================================
CREATE TABLE coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    type coin_transaction_type NOT NULL,
    description TEXT,
    match_id UUID REFERENCES matches(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coin_user ON coin_transactions(user_id);
CREATE INDEX idx_coin_type ON coin_transactions(type);

-- ============================================
-- LEADERBOARD TABLE
-- ============================================
CREATE TABLE leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    rank INTEGER NOT NULL,
    total_coins INTEGER NOT NULL DEFAULT 0,
    total_matches INTEGER NOT NULL DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    tier TEXT DEFAULT 'organizer',
    period TEXT DEFAULT 'all_time',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leaderboard_rank ON leaderboard(rank);

-- ============================================
-- DISPUTES TABLE
-- ============================================
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id),
    raised_by UUID NOT NULL REFERENCES profiles(id),
    raised_against UUID REFERENCES profiles(id),
    dispute_type TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence_urls JSONB DEFAULT '[]',
    status dispute_status NOT NULL DEFAULT 'open',
    assigned_to UUID REFERENCES profiles(id),
    resolution TEXT,
    refund_amount INTEGER DEFAULT 0,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disputes_status ON disputes(status);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- ============================================
-- COMMUNITIES TABLE
-- ============================================
CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    owner_id UUID NOT NULL REFERENCES profiles(id),
    location TEXT,
    sport_type TEXT DEFAULT 'football',
    status verification_status NOT NULL DEFAULT 'pending',
    member_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_communities_status ON communities(status);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;

-- Allow all operations for demo (change in production)
CREATE POLICY "Allow all profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all matches" ON matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all positions" ON match_positions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all bookings" ON match_bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all verifications" ON verifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all ratings" ON ratings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all transactions" ON coin_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all leaderboard" ON leaderboard FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all disputes" ON disputes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all communities" ON communities FOR ALL USING (true) WITH CHECK (true);