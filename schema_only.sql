--
-- PostgreSQL database dump
--

\restrict XxR7Cv8NxrvcnsxDeecQdyhMkMAG7YeGpRGxTaELa6isp3azO8V7cRtN6wfe8N3

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    name text NOT NULL,
    role text NOT NULL,
    is_active integer DEFAULT 1 NOT NULL,
    permissions text,
    mfa_enabled integer DEFAULT 0,
    created_by text,
    last_login_at text,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL,
    previous_login_at text,
    last_activity_checkpoint_at text,
    CONSTRAINT admin_users_role_check CHECK ((role = ANY (ARRAY['MASTER_ADMIN'::text, 'ADMIN'::text])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    action text NOT NULL,
    category text NOT NULL,
    admin_id text,
    admin_name text,
    admin_email text,
    admin_role text,
    target_id text,
    target_type text,
    target_name text,
    details text,
    previous_value text,
    new_value text,
    ip_address text,
    user_agent text,
    severity text DEFAULT 'info'::text,
    created_at text DEFAULT (now())::text NOT NULL
);


--
-- Name: carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carts (
    id text NOT NULL,
    owner_type text NOT NULL,
    owner_id text NOT NULL,
    items text DEFAULT '[]'::text NOT NULL,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL,
    CONSTRAINT carts_owner_type_check CHECK ((owner_type = ANY (ARRAY['guest'::text, 'user'::text])))
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    icon text,
    image_url text,
    parent_id text,
    is_active integer DEFAULT 1 NOT NULL,
    show_in_menu integer DEFAULT 1 NOT NULL,
    show_in_home integer DEFAULT 1 NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    form_schema text,
    created_by text,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id text NOT NULL,
    buyer_id text NOT NULL,
    buyer_name text NOT NULL,
    buyer_avatar text,
    vendor_id text NOT NULL,
    vendor_name text NOT NULL,
    vendor_avatar text,
    vendor_business_name text,
    context text DEFAULT 'general'::text NOT NULL,
    product_id text,
    product_name text,
    product_image text,
    order_id text,
    order_number text,
    dispute_id text,
    status text DEFAULT 'active'::text NOT NULL,
    is_pinned_buyer integer DEFAULT 0,
    is_pinned_vendor integer DEFAULT 0,
    is_muted_buyer integer DEFAULT 0,
    is_muted_vendor integer DEFAULT 0,
    last_message_id text,
    last_message_content text,
    last_message_at text,
    last_message_sender_id text,
    unread_count_buyer integer DEFAULT 0,
    unread_count_vendor integer DEFAULT 0,
    archived_at text,
    archived_by text,
    flagged_at text,
    flagged_by text,
    flag_reason text,
    moderator_notes text,
    reviewed_at text,
    reviewed_by text,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL,
    CONSTRAINT conversations_context_check CHECK ((context = ANY (ARRAY['product_inquiry'::text, 'order_support'::text, 'general'::text, 'dispute'::text]))),
    CONSTRAINT conversations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text, 'flagged'::text, 'closed'::text])))
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id text NOT NULL,
    vendor_user_id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    discount_type text NOT NULL,
    discount_value real NOT NULL,
    min_order_amount real DEFAULT 0,
    usage_limit integer,
    usage_count integer DEFAULT 0,
    starts_at text NOT NULL,
    ends_at text NOT NULL,
    is_active integer DEFAULT 1,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL,
    CONSTRAINT coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text])))
);


--
-- Name: disputes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disputes (
    id text NOT NULL,
    order_id text NOT NULL,
    buyer_id text NOT NULL,
    vendor_id text NOT NULL,
    type text NOT NULL,
    reason text,
    amount real DEFAULT 0,
    status text DEFAULT 'open'::text NOT NULL,
    resolution text,
    resolved_by text,
    resolved_at text,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id text NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    body_html text NOT NULL,
    body_text text,
    variables text,
    category text NOT NULL,
    is_active integer DEFAULT 1,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL,
    CONSTRAINT email_templates_category_check CHECK ((category = ANY (ARRAY['order'::text, 'payment'::text, 'auth'::text, 'notification'::text, 'system'::text])))
);


--
-- Name: footer_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.footer_links (
    id text NOT NULL,
    section text NOT NULL,
    title text NOT NULL,
    url text NOT NULL,
    order_num integer DEFAULT 0,
    is_visible boolean DEFAULT true,
    is_external boolean DEFAULT false,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL
);


--
-- Name: hero_slides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hero_slides (
    id text NOT NULL,
    title text,
    subtitle text,
    image_url text NOT NULL,
    link_url text,
    order_num integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL
);


--
-- Name: integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integrations (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    provider text NOT NULL,
    category text NOT NULL,
    is_enabled integer DEFAULT 0,
    is_configured integer DEFAULT 0,
    environment text DEFAULT 'demo'::text,
    status text DEFAULT 'not_configured'::text,
    credentials text,
    last_tested_at text,
    last_error text,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id text NOT NULL,
    conversation_id text NOT NULL,
    sender_id text NOT NULL,
    sender_name text NOT NULL,
    sender_role text NOT NULL,
    sender_avatar text,
    content text NOT NULL,
    message_type text DEFAULT 'text'::text NOT NULL,
    attachment_url text,
    attachment_name text,
    is_read integer DEFAULT 0,
    read_at text,
    is_deleted integer DEFAULT 0,
    deleted_at text,
    deleted_by text,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL,
    CONSTRAINT messages_message_type_check CHECK ((message_type = ANY (ARRAY['text'::text, 'image'::text, 'file'::text, 'system'::text]))),
    CONSTRAINT messages_sender_role_check CHECK ((sender_role = ANY (ARRAY['buyer'::text, 'vendor'::text, 'admin'::text])))
);


--
-- Name: messaging_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messaging_audit_logs (
    id text NOT NULL,
    action text NOT NULL,
    performed_by text NOT NULL,
    performed_by_role text NOT NULL,
    conversation_id text,
    message_id text,
    details text,
    created_at text DEFAULT (now())::text NOT NULL,
    CONSTRAINT messaging_audit_logs_performed_by_role_check CHECK ((performed_by_role = ANY (ARRAY['buyer'::text, 'vendor'::text, 'admin'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    user_id text NOT NULL,
    role text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    payload text,
    is_read integer DEFAULT 0,
    created_at text DEFAULT (now())::text NOT NULL,
    CONSTRAINT notifications_role_check CHECK ((role = ANY (ARRAY['buyer'::text, 'vendor'::text, 'admin'::text])))
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id text NOT NULL,
    order_id text NOT NULL,
    product_id text NOT NULL,
    product_name text NOT NULL,
    vendor_id text NOT NULL,
    vendor_name text NOT NULL,
    quantity integer NOT NULL,
    unit_price real NOT NULL,
    applied_discount real DEFAULT 0,
    final_price real NOT NULL,
    fulfillment_status text DEFAULT 'pending'::text NOT NULL,
    fulfilled_at text,
    image text,
    variations text,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL,
    vendor_courier_provider text,
    vendor_courier_reference text,
    vendor_delivered_at text,
    vendor_ready_for_pickup_at text,
    CONSTRAINT order_items_fulfillment_status_check CHECK ((fulfillment_status = ANY (ARRAY['pending'::text, 'packed'::text, 'handed_to_courier'::text, 'delivered'::text, 'shipped'::text, 'fulfilled'::text])))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id text NOT NULL,
    buyer_id text NOT NULL,
    buyer_name text NOT NULL,
    buyer_email text NOT NULL,
    items text NOT NULL,
    subtotal real NOT NULL,
    shipping_fee real DEFAULT 0,
    tax real DEFAULT 0,
    total real NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    payment_method text,
    shipping_address text NOT NULL,
    tracking_number text,
    notes text,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL,
    discount_total real DEFAULT 0,
    coupon_code text,
    payment_reference text,
    payment_provider text,
    paid_at text,
    currency text DEFAULT 'GHS'::text,
    courier_provider text,
    courier_reference text,
    delivered_at text,
    disputed_at text,
    dispute_reason text,
    CONSTRAINT orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text]))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['created'::text, 'confirmed'::text, 'preparing'::text, 'ready_for_pickup'::text, 'out_for_delivery'::text, 'delivered'::text, 'completed'::text, 'cancelled'::text, 'disputed'::text, 'delivery_failed'::text, 'pending_payment'::text, 'pending'::text, 'fulfilled'::text, 'processing'::text, 'shipped'::text, 'refunded'::text])))
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id text NOT NULL,
    user_id text NOT NULL,
    token_hash text NOT NULL,
    expires_at text NOT NULL,
    used_at text,
    created_at text DEFAULT (now())::text NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id text NOT NULL,
    vendor_id text NOT NULL,
    vendor_name text NOT NULL,
    name text NOT NULL,
    description text,
    category text,
    category_id text,
    price real NOT NULL,
    compare_price real,
    cost_per_item real,
    sku text,
    barcode text,
    quantity integer DEFAULT 0,
    track_quantity integer DEFAULT 1,
    images text,
    weight real,
    dimensions text,
    tags text,
    status text DEFAULT 'active'::text NOT NULL,
    category_attributes text,
    approval_status text,
    approved_by text,
    approved_at text,
    rejection_reason text,
    suspended_by text,
    suspended_at text,
    suspension_reason text,
    is_featured integer DEFAULT 0,
    featured_at text,
    featured_by text,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL,
    condition text
);


--
-- Name: review_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_media (
    id text NOT NULL,
    review_id text NOT NULL,
    file_url text NOT NULL,
    file_type text DEFAULT 'image'::text NOT NULL,
    created_at text DEFAULT (now())::text NOT NULL
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id text NOT NULL,
    product_id text NOT NULL,
    buyer_id text NOT NULL,
    vendor_id text NOT NULL,
    rating integer NOT NULL,
    comment text NOT NULL,
    is_verified_purchase integer DEFAULT 0,
    status text DEFAULT 'active'::text NOT NULL,
    helpful_count integer DEFAULT 0,
    edited_at text,
    vendor_reply text,
    vendor_reply_at text,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT reviews_status_check CHECK ((status = ANY (ARRAY['active'::text, 'hidden'::text, 'deleted'::text])))
);


--
-- Name: sale_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_products (
    id text NOT NULL,
    sale_id text NOT NULL,
    product_id text NOT NULL,
    created_at text DEFAULT (now())::text NOT NULL
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id text NOT NULL,
    vendor_user_id text NOT NULL,
    name text NOT NULL,
    discount_type text NOT NULL,
    discount_value real NOT NULL,
    starts_at text NOT NULL,
    ends_at text NOT NULL,
    is_active integer DEFAULT 1,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL,
    CONSTRAINT sales_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text])))
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    user_id text NOT NULL,
    user_role text NOT NULL,
    token_hash text NOT NULL,
    ip_address text,
    user_agent text,
    expires_at text NOT NULL,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text
);


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings (
    key text NOT NULL,
    value text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL,
    updated_by text
);


--
-- Name: static_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.static_pages (
    id text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    meta_title text,
    meta_description text,
    is_published boolean DEFAULT false,
    show_in_footer boolean DEFAULT false,
    show_in_header boolean DEFAULT false,
    order_index integer DEFAULT 0,
    created_by text,
    updated_by text,
    published_at text,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    password_hash text,
    name text NOT NULL,
    role text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    avatar text,
    phone text,
    location text,
    business_name text,
    business_type text,
    verification_status text,
    verification_documents text,
    verification_notes text,
    verified_at text,
    verified_by text,
    store_description text,
    store_banner text,
    store_logo text,
    is_deleted integer DEFAULT 0,
    deleted_at text,
    deleted_by text,
    deletion_reason text,
    last_login_at text,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL,
    previous_login_at text,
    last_activity_checkpoint_at text,
    created_by text,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['buyer'::text, 'vendor'::text, 'admin'::text, 'master_admin'::text])))
);


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id text NOT NULL,
    user_id text NOT NULL,
    business_name text NOT NULL,
    business_type text,
    description text,
    logo text,
    banner text,
    phone text,
    email text,
    address text,
    city text,
    region text,
    verification_status text DEFAULT 'pending'::text NOT NULL,
    verification_documents text,
    verification_notes text,
    verified_at text,
    verified_by text,
    store_status text DEFAULT 'inactive'::text NOT NULL,
    commission_rate real DEFAULT 0.10,
    total_sales real DEFAULT 0,
    total_orders integer DEFAULT 0,
    rating real DEFAULT 0,
    review_count integer DEFAULT 0,
    created_at text DEFAULT (now())::text NOT NULL,
    updated_at text DEFAULT (now())::text NOT NULL,
    CONSTRAINT vendors_store_status_check CHECK ((store_status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text]))),
    CONSTRAINT vendors_verification_status_check CHECK ((verification_status = ANY (ARRAY['pending'::text, 'under_review'::text, 'verified'::text, 'rejected'::text, 'suspended'::text])))
);


--
-- Name: wishlist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlist_items (
    id text NOT NULL,
    user_id text NOT NULL,
    product_id text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_users admin_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_email_key UNIQUE (email);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: carts carts_owner_type_owner_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_owner_type_owner_id_key UNIQUE (owner_type, owner_id);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_vendor_user_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_vendor_user_id_code_key UNIQUE (vendor_user_id, code);


--
-- Name: disputes disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_name_key UNIQUE (name);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: footer_links footer_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.footer_links
    ADD CONSTRAINT footer_links_pkey PRIMARY KEY (id);


--
-- Name: hero_slides hero_slides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hero_slides
    ADD CONSTRAINT hero_slides_pkey PRIMARY KEY (id);


--
-- Name: integrations integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: messaging_audit_logs messaging_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_audit_logs
    ADD CONSTRAINT messaging_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: review_media review_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_media
    ADD CONSTRAINT review_media_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_product_id_buyer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_product_id_buyer_id_key UNIQUE (product_id, buyer_id);


--
-- Name: sale_products sale_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_products
    ADD CONSTRAINT sale_products_pkey PRIMARY KEY (id);


--
-- Name: sale_products sale_products_sale_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_products
    ADD CONSTRAINT sale_products_sale_id_product_id_key UNIQUE (sale_id, product_id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (key);


--
-- Name: static_pages static_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.static_pages
    ADD CONSTRAINT static_pages_pkey PRIMARY KEY (id);


--
-- Name: static_pages static_pages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.static_pages
    ADD CONSTRAINT static_pages_slug_key UNIQUE (slug);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_user_id_key UNIQUE (user_id);


--
-- Name: wishlist_items wishlist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_pkey PRIMARY KEY (id);


--
-- Name: wishlist_items wishlist_items_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_user_id_product_id_key UNIQUE (user_id, product_id);


--
-- Name: idx_carts_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carts_owner ON public.carts USING btree (owner_type, owner_id);


--
-- Name: idx_categories_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_parent ON public.categories USING btree (parent_id);


--
-- Name: idx_categories_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_slug ON public.categories USING btree (slug);


--
-- Name: idx_conversations_buyer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_buyer ON public.conversations USING btree (buyer_id);


--
-- Name: idx_conversations_context; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_context ON public.conversations USING btree (context);


--
-- Name: idx_conversations_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_order ON public.conversations USING btree (order_id);


--
-- Name: idx_conversations_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_product ON public.conversations USING btree (product_id);


--
-- Name: idx_conversations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_status ON public.conversations USING btree (status);


--
-- Name: idx_conversations_unique_context; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_conversations_unique_context ON public.conversations USING btree (buyer_id, vendor_id, context, COALESCE(product_id, ''::text), COALESCE(order_id, ''::text));


--
-- Name: idx_conversations_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_updated ON public.conversations USING btree (updated_at DESC);


--
-- Name: idx_conversations_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_vendor ON public.conversations USING btree (vendor_id);


--
-- Name: idx_coupons_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_active ON public.coupons USING btree (is_active);


--
-- Name: idx_coupons_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_code ON public.coupons USING btree (code);


--
-- Name: idx_coupons_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_vendor ON public.coupons USING btree (vendor_user_id);


--
-- Name: idx_disputes_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_order ON public.disputes USING btree (order_id);


--
-- Name: idx_disputes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_status ON public.disputes USING btree (status);


--
-- Name: idx_email_templates_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_templates_category ON public.email_templates USING btree (category);


--
-- Name: idx_email_templates_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_templates_name ON public.email_templates USING btree (name);


--
-- Name: idx_footer_links_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_footer_links_section ON public.footer_links USING btree (section);


--
-- Name: idx_footer_links_visible; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_footer_links_visible ON public.footer_links USING btree (is_visible);


--
-- Name: idx_hero_slides_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hero_slides_active ON public.hero_slides USING btree (is_active);


--
-- Name: idx_hero_slides_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hero_slides_order ON public.hero_slides USING btree (order_num);


--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id);


--
-- Name: idx_messages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_created ON public.messages USING btree (created_at DESC);


--
-- Name: idx_messages_sender; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_sender ON public.messages USING btree (sender_id);


--
-- Name: idx_messages_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_unread ON public.messages USING btree (conversation_id, is_read) WHERE (is_read = 0);


--
-- Name: idx_messaging_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messaging_audit_action ON public.messaging_audit_logs USING btree (action);


--
-- Name: idx_messaging_audit_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messaging_audit_conversation ON public.messaging_audit_logs USING btree (conversation_id);


--
-- Name: idx_messaging_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messaging_audit_created ON public.messaging_audit_logs USING btree (created_at DESC);


--
-- Name: idx_notifications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_role ON public.notifications USING btree (role);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_order_items_fulfillment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_fulfillment ON public.order_items USING btree (fulfillment_status);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_product ON public.order_items USING btree (product_id);


--
-- Name: idx_order_items_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_vendor ON public.order_items USING btree (vendor_id);


--
-- Name: idx_orders_buyer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_buyer ON public.orders USING btree (buyer_id);


--
-- Name: idx_password_reset_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_token ON public.password_reset_tokens USING btree (token_hash);


--
-- Name: idx_password_reset_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_user ON public.password_reset_tokens USING btree (user_id);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category ON public.products USING btree (category_id);


--
-- Name: idx_products_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_vendor ON public.products USING btree (vendor_id);


--
-- Name: idx_review_media_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_review_media_review ON public.review_media USING btree (review_id);


--
-- Name: idx_reviews_buyer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_buyer ON public.reviews USING btree (buyer_id);


--
-- Name: idx_reviews_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_product ON public.reviews USING btree (product_id);


--
-- Name: idx_reviews_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_status ON public.reviews USING btree (status);


--
-- Name: idx_reviews_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_vendor ON public.reviews USING btree (vendor_id);


--
-- Name: idx_sale_products_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_products_product ON public.sale_products USING btree (product_id);


--
-- Name: idx_sale_products_sale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_products_sale ON public.sale_products USING btree (sale_id);


--
-- Name: idx_sales_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_active ON public.sales USING btree (is_active);


--
-- Name: idx_sales_vendor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_vendor ON public.sales USING btree (vendor_user_id);


--
-- Name: idx_sessions_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_token ON public.sessions USING btree (token_hash);


--
-- Name: idx_static_pages_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_static_pages_published ON public.static_pages USING btree (is_published);


--
-- Name: idx_static_pages_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_static_pages_slug ON public.static_pages USING btree (slug);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_vendors_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_user_id ON public.vendors USING btree (user_id);


--
-- Name: idx_vendors_verification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_verification ON public.vendors USING btree (verification_status);


--
-- Name: idx_wishlist_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_product ON public.wishlist_items USING btree (product_id);


--
-- Name: idx_wishlist_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_user ON public.wishlist_items USING btree (user_id);


--
-- Name: categories fk_categories_parent; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: conversations fk_conversations_buyer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT fk_conversations_buyer FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversations fk_conversations_vendor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT fk_conversations_vendor FOREIGN KEY (vendor_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages fk_messages_conversation; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages fk_messages_sender; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: messaging_audit_logs fk_messaging_audit_conversation; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_audit_logs
    ADD CONSTRAINT fk_messaging_audit_conversation FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;


--
-- Name: messaging_audit_logs fk_messaging_audit_message; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messaging_audit_logs
    ADD CONSTRAINT fk_messaging_audit_message FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE SET NULL;


--
-- Name: notifications fk_notifications_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: order_items fk_order_items_order; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items fk_order_items_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: order_items fk_order_items_vendor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT fk_order_items_vendor FOREIGN KEY (vendor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: password_reset_tokens fk_password_reset_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: products fk_products_category; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: review_media fk_review_media_review; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_media
    ADD CONSTRAINT fk_review_media_review FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;


--
-- Name: reviews fk_reviews_buyer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fk_reviews_buyer FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reviews fk_reviews_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: sale_products fk_sale_products_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_products
    ADD CONSTRAINT fk_sale_products_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: sale_products fk_sale_products_sale; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_products
    ADD CONSTRAINT fk_sale_products_sale FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;


--
-- Name: vendors fk_vendors_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT fk_vendors_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wishlist_items fk_wishlist_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: wishlist_items fk_wishlist_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict XxR7Cv8NxrvcnsxDeecQdyhMkMAG7YeGpRGxTaELa6isp3azO8V7cRtN6wfe8N3

