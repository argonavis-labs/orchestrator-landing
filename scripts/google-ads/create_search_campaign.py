#!/usr/bin/env python3
"""Create a Google Ads Search campaign optimized for download conversions."""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from uuid import uuid4

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException
from google.protobuf.field_mask_pb2 import FieldMask


DEFAULT_KEYWORDS = (
    "ai operations assistant",
    "ai executive assistant",
    "ai personal assistant app",
    "workflow automation ai",
    "agentic ai assistant",
    "desktop ai assistant",
    "business process automation ai",
    "automate email and calendar",
    "task automation ai app",
    "claude code automation",
)

DEFAULT_NEGATIVE_KEYWORDS = (
    "jobs",
    "salary",
    "free",
    "open source",
    "course",
)

DEFAULT_HEADLINES = (
    "AI Operator for Daily Work",
    "Automate Work Across Apps",
    "Run Multi-Step Work in Chat",
    "Delegate Email and Calendar",
    "Download Orchestrator",
    "Desktop App for AI Operations",
    "From Request to Done",
    "Built for Operators and Teams",
    "Install in Minutes",
    "Works Across Your Tool Stack",
    "Automate Repetitive Work",
    "Track Progress in One Place",
    "Fast AI Workflow Execution",
    "One Chat for Daily Operations",
    "Get More Done with AI",
)

DEFAULT_DESCRIPTIONS = (
    "Delegate multi-step work across your tools from one chat interface.",
    "Orchestrator executes tasks across email, calendar, docs, and project tools.",
    "Download for macOS, Windows, and Linux and get productive quickly.",
    "Designed for teams that need outcomes, not just AI answers.",
)


def _digits_only(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def _clean_text_values(raw_values: str) -> list[str]:
    values = [item.strip() for item in raw_values.split(",")]
    return [item for item in values if item]


def build_client(args: argparse.Namespace) -> GoogleAdsClient:
    config = {
        "developer_token": args.developer_token,
        "client_id": args.client_id,
        "client_secret": args.client_secret,
        "refresh_token": args.refresh_token,
        "login_customer_id": _digits_only(args.login_customer_id) if args.login_customer_id else None,
        "use_proto_plus": True,
    }

    # Remove None values before loading.
    config = {key: value for key, value in config.items() if value is not None}
    return GoogleAdsClient.load_from_dict(config, version="v20")


def enable_auto_tagging(
    client: GoogleAdsClient,
    customer_id: str,
) -> None:
    customer_service = client.get_service("CustomerService")

    operation = client.get_type("CustomerOperation")
    operation.update.resource_name = customer_service.customer_path(customer_id)
    operation.update.auto_tagging_enabled = True
    operation.update_mask.CopyFrom(FieldMask(paths=["auto_tagging_enabled"]))

    customer_service.mutate_customer(customer_id=customer_id, operation=operation)


def create_campaign_budget(
    client: GoogleAdsClient,
    customer_id: str,
    daily_budget_usd: float,
    name_prefix: str,
) -> str:
    campaign_budget_service = client.get_service("CampaignBudgetService")
    operation = client.get_type("CampaignBudgetOperation")
    budget = operation.create
    budget.name = f"{name_prefix} Budget {uuid4().hex[:8]}"
    budget.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
    budget.amount_micros = int(daily_budget_usd * 1_000_000)
    budget.explicitly_shared = False

    response = campaign_budget_service.mutate_campaign_budgets(
        customer_id=customer_id,
        operations=[operation],
    )
    return response.results[0].resource_name


def create_search_campaign(
    client: GoogleAdsClient,
    customer_id: str,
    campaign_name: str,
    budget_resource_name: str,
    enabled: bool,
    end_after_24h: bool,
) -> str:
    campaign_service = client.get_service("CampaignService")
    operation = client.get_type("CampaignOperation")
    campaign = operation.create
    campaign.name = f"{campaign_name} {dt.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"
    campaign.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.SEARCH
    campaign.status = (
        client.enums.CampaignStatusEnum.ENABLED
        if enabled
        else client.enums.CampaignStatusEnum.PAUSED
    )
    campaign.campaign_budget = budget_resource_name

    campaign.network_settings.target_google_search = True
    campaign.network_settings.target_search_network = True
    campaign.network_settings.target_content_network = False
    campaign.network_settings.target_partner_search_network = False

    campaign.maximize_conversions.CopyFrom(client.get_type("MaximizeConversions"))

    today = dt.date.today()
    campaign.start_date = today.strftime("%Y%m%d")
    if end_after_24h:
        campaign.end_date = (today + dt.timedelta(days=1)).strftime("%Y%m%d")

    response = campaign_service.mutate_campaigns(
        customer_id=customer_id,
        operations=[operation],
    )
    return response.results[0].resource_name


def add_campaign_targeting(
    client: GoogleAdsClient,
    customer_id: str,
    campaign_resource_name: str,
    geo_target_ids: list[str],
    language_ids: list[str],
) -> None:
    campaign_criterion_service = client.get_service("CampaignCriterionService")
    operations = []

    for geo_id in geo_target_ids:
        operation = client.get_type("CampaignCriterionOperation")
        criterion = operation.create
        criterion.campaign = campaign_resource_name
        criterion.location.geo_target_constant = f"geoTargetConstants/{geo_id}"
        operations.append(operation)

    for language_id in language_ids:
        operation = client.get_type("CampaignCriterionOperation")
        criterion = operation.create
        criterion.campaign = campaign_resource_name
        criterion.language.language_constant = f"languageConstants/{language_id}"
        operations.append(operation)

    if operations:
        campaign_criterion_service.mutate_campaign_criteria(
            customer_id=customer_id,
            operations=operations,
        )


def add_campaign_negative_keywords(
    client: GoogleAdsClient,
    customer_id: str,
    campaign_resource_name: str,
    negative_keywords: list[str],
) -> None:
    if not negative_keywords:
        return

    campaign_criterion_service = client.get_service("CampaignCriterionService")
    operations = []

    for keyword_text in negative_keywords:
        operation = client.get_type("CampaignCriterionOperation")
        criterion = operation.create
        criterion.campaign = campaign_resource_name
        criterion.negative = True
        criterion.keyword.text = keyword_text
        criterion.keyword.match_type = client.enums.KeywordMatchTypeEnum.PHRASE
        operations.append(operation)

    campaign_criterion_service.mutate_campaign_criteria(
        customer_id=customer_id,
        operations=operations,
    )


def create_ad_group(
    client: GoogleAdsClient,
    customer_id: str,
    campaign_resource_name: str,
    ad_group_name: str,
    enabled: bool,
) -> str:
    ad_group_service = client.get_service("AdGroupService")
    operation = client.get_type("AdGroupOperation")
    ad_group = operation.create
    ad_group.name = ad_group_name
    ad_group.campaign = campaign_resource_name
    ad_group.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
    ad_group.status = (
        client.enums.AdGroupStatusEnum.ENABLED
        if enabled
        else client.enums.AdGroupStatusEnum.PAUSED
    )

    response = ad_group_service.mutate_ad_groups(
        customer_id=customer_id,
        operations=[operation],
    )
    return response.results[0].resource_name


def add_ad_group_keywords(
    client: GoogleAdsClient,
    customer_id: str,
    ad_group_resource_name: str,
    keywords: list[str],
) -> None:
    ad_group_criterion_service = client.get_service("AdGroupCriterionService")
    operations = []

    for keyword_text in keywords:
        for match_type in (
            client.enums.KeywordMatchTypeEnum.EXACT,
            client.enums.KeywordMatchTypeEnum.PHRASE,
        ):
            operation = client.get_type("AdGroupCriterionOperation")
            criterion = operation.create
            criterion.ad_group = ad_group_resource_name
            criterion.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
            criterion.keyword.text = keyword_text
            criterion.keyword.match_type = match_type
            operations.append(operation)

    if operations:
        ad_group_criterion_service.mutate_ad_group_criteria(
            customer_id=customer_id,
            operations=operations,
        )


def create_responsive_search_ad(
    client: GoogleAdsClient,
    customer_id: str,
    ad_group_resource_name: str,
    final_url: str,
    headlines: list[str],
    descriptions: list[str],
    enabled: bool,
) -> None:
    ad_group_ad_service = client.get_service("AdGroupAdService")
    operation = client.get_type("AdGroupAdOperation")
    ad_group_ad = operation.create
    ad_group_ad.ad_group = ad_group_resource_name
    ad_group_ad.status = (
        client.enums.AdGroupAdStatusEnum.ENABLED
        if enabled
        else client.enums.AdGroupAdStatusEnum.PAUSED
    )
    ad_group_ad.ad.final_urls.append(final_url)

    responsive_search_ad = ad_group_ad.ad.responsive_search_ad
    for headline in headlines[:15]:
        asset = client.get_type("AdTextAsset")
        asset.text = headline
        responsive_search_ad.headlines.append(asset)

    for description in descriptions[:4]:
        asset = client.get_type("AdTextAsset")
        asset.text = description
        responsive_search_ad.descriptions.append(asset)

    ad_group_ad.ad.path1 = "download"
    ad_group_ad.ad.path2 = "desktop"

    ad_group_ad_service.mutate_ad_group_ads(
        customer_id=customer_id,
        operations=[operation],
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a Search campaign for Orchestrator download growth.",
    )
    parser.add_argument("--developer-token", required=True)
    parser.add_argument("--client-id", required=True)
    parser.add_argument("--client-secret", required=True)
    parser.add_argument("--refresh-token", required=True)
    parser.add_argument("--customer-id", required=True, help="Google Ads customer ID.")
    parser.add_argument(
        "--login-customer-id",
        default="",
        help="Manager account ID (required when mutating a child account).",
    )
    parser.add_argument(
        "--campaign-name",
        default="Orchestrator Downloads 24h Search",
    )
    parser.add_argument(
        "--ad-group-name",
        default="High Intent Downloads",
    )
    parser.add_argument(
        "--daily-budget-usd",
        type=float,
        default=1000.0,
    )
    parser.add_argument(
        "--final-url",
        default="https://orchest.org/download/",
    )
    parser.add_argument(
        "--geo-target-ids",
        default="2840,2124",
        help="Comma-separated geo target constant IDs. Default: US, CA.",
    )
    parser.add_argument(
        "--language-ids",
        default="1000",
        help="Comma-separated language constant IDs. Default: English.",
    )
    parser.add_argument(
        "--keywords",
        default=",".join(DEFAULT_KEYWORDS),
        help="Comma-separated keyword list (phrase/exact match variants are created).",
    )
    parser.add_argument(
        "--negative-keywords",
        default=",".join(DEFAULT_NEGATIVE_KEYWORDS),
        help="Comma-separated campaign-level negative keywords.",
    )
    parser.add_argument(
        "--headlines",
        default=",".join(DEFAULT_HEADLINES),
        help="Comma-separated RSA headlines (max 15 used).",
    )
    parser.add_argument(
        "--descriptions",
        default=",".join(DEFAULT_DESCRIPTIONS),
        help="Comma-separated RSA descriptions (max 4 used).",
    )
    parser.add_argument(
        "--pause-on-create",
        action="store_true",
        help="Create campaign and ads in PAUSED state.",
    )
    parser.add_argument(
        "--end-after-24h",
        action="store_true",
        help="Set campaign end date to tomorrow.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    customer_id = _digits_only(args.customer_id)
    if not customer_id:
        print("ERROR: --customer-id is required and must contain digits.", file=sys.stderr)
        return 2

    login_customer_id = _digits_only(args.login_customer_id)
    if login_customer_id and login_customer_id == customer_id:
        # Equivalent to unset for API requests.
        login_customer_id = ""

    args.login_customer_id = login_customer_id

    geo_target_ids = _clean_text_values(args.geo_target_ids)
    language_ids = _clean_text_values(args.language_ids)
    keywords = _clean_text_values(args.keywords)
    negative_keywords = _clean_text_values(args.negative_keywords)
    headlines = _clean_text_values(args.headlines)
    descriptions = _clean_text_values(args.descriptions)

    if not geo_target_ids:
        print("ERROR: at least one geo target is required.", file=sys.stderr)
        return 2
    if not language_ids:
        print("ERROR: at least one language ID is required.", file=sys.stderr)
        return 2
    if not keywords:
        print("ERROR: at least one keyword is required.", file=sys.stderr)
        return 2
    if len(headlines) < 3:
        print("ERROR: provide at least 3 headlines.", file=sys.stderr)
        return 2
    if len(descriptions) < 2:
        print("ERROR: provide at least 2 descriptions.", file=sys.stderr)
        return 2

    client = build_client(args)
    enabled = not args.pause_on_create

    try:
        enable_auto_tagging(client, customer_id)
        budget_resource_name = create_campaign_budget(
            client=client,
            customer_id=customer_id,
            daily_budget_usd=args.daily_budget_usd,
            name_prefix=args.campaign_name,
        )
        campaign_resource_name = create_search_campaign(
            client=client,
            customer_id=customer_id,
            campaign_name=args.campaign_name,
            budget_resource_name=budget_resource_name,
            enabled=enabled,
            end_after_24h=args.end_after_24h,
        )
        add_campaign_targeting(
            client=client,
            customer_id=customer_id,
            campaign_resource_name=campaign_resource_name,
            geo_target_ids=geo_target_ids,
            language_ids=language_ids,
        )
        add_campaign_negative_keywords(
            client=client,
            customer_id=customer_id,
            campaign_resource_name=campaign_resource_name,
            negative_keywords=negative_keywords,
        )
        ad_group_resource_name = create_ad_group(
            client=client,
            customer_id=customer_id,
            campaign_resource_name=campaign_resource_name,
            ad_group_name=args.ad_group_name,
            enabled=enabled,
        )
        add_ad_group_keywords(
            client=client,
            customer_id=customer_id,
            ad_group_resource_name=ad_group_resource_name,
            keywords=keywords,
        )
        create_responsive_search_ad(
            client=client,
            customer_id=customer_id,
            ad_group_resource_name=ad_group_resource_name,
            final_url=args.final_url,
            headlines=headlines,
            descriptions=descriptions,
            enabled=enabled,
        )

        print("Campaign created successfully.")
        print(f"Customer ID: {customer_id}")
        print(f"Campaign Resource: {campaign_resource_name}")
        print(f"Ad Group Resource: {ad_group_resource_name}")
        print(f"Budget Resource: {budget_resource_name}")
        print(
            "Recommendation: verify conversion status and search terms, then iterate keywords/negatives every 2-4 hours for the 24h sprint."
        )
        return 0
    except GoogleAdsException as exc:
        print("Google Ads API error:", file=sys.stderr)
        for error in exc.failure.errors:
            location = " > ".join(
                element.field_name for element in error.location.field_path_elements
            ) if error.location else "unknown"
            print(f"- {error.error_code}: {error.message} (field: {location})", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
