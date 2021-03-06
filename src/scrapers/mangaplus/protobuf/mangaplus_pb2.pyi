"""
@generated by mypy-protobuf.  Do not edit manually!
isort:skip_file
"""
import builtins
import typing

import google.protobuf.descriptor
import google.protobuf.internal.containers
import google.protobuf.internal.enum_type_wrapper
import google.protobuf.message
import typing_extensions

DESCRIPTOR: google.protobuf.descriptor.FileDescriptor = ...

global___Action = Action
class _Action(google.protobuf.internal.enum_type_wrapper._EnumTypeWrapper[Action.V], builtins.type):
    DESCRIPTOR: google.protobuf.descriptor.EnumDescriptor = ...
    DEFAULT = Action.V(0)
    UNAUTHORIZED = Action.V(1)
    MAINTENANCE = Action.V(2)
    GEOIP_BLOCKING = Action.V(3)
class Action(metaclass=_Action):
    V = typing.NewType('V', builtins.int)
DEFAULT = Action.V(0)
UNAUTHORIZED = Action.V(1)
MAINTENANCE = Action.V(2)
GEOIP_BLOCKING = Action.V(3)

class UpdatedTitle(google.protobuf.message.Message):
    DESCRIPTOR: google.protobuf.descriptor.Descriptor = ...
    TITLE_FIELD_NUMBER: builtins.int
    CHAPTER_ID_FIELD_NUMBER: builtins.int
    CHAPTER_NAME_FIELD_NUMBER: builtins.int
    CHAPTER_SUB_TITLE_FIELD_NUMBER: builtins.int
    IS_LATEST_FIELD_NUMBER: builtins.int
    chapter_id: builtins.int = ...
    chapter_name: typing.Text = ...
    chapter_sub_title: typing.Text = ...
    is_latest: builtins.bool = ...

    @property
    def title(self) -> global___Title: ...

    def __init__(self,
        *,
        title : typing.Optional[global___Title] = ...,
        chapter_id : builtins.int = ...,
        chapter_name : typing.Text = ...,
        chapter_sub_title : typing.Text = ...,
        is_latest : builtins.bool = ...,
        ) -> None: ...
    def HasField(self, field_name: typing_extensions.Literal[u"title",b"title"]) -> builtins.bool: ...
    def ClearField(self, field_name: typing_extensions.Literal[u"chapter_id",b"chapter_id",u"chapter_name",b"chapter_name",u"chapter_sub_title",b"chapter_sub_title",u"is_latest",b"is_latest",u"title",b"title"]) -> None: ...
global___UpdatedTitle = UpdatedTitle

class UpdatedTitleGroup(google.protobuf.message.Message):
    DESCRIPTOR: google.protobuf.descriptor.Descriptor = ...
    TITLES_FIELD_NUMBER: builtins.int

    @property
    def titles(self) -> google.protobuf.internal.containers.RepeatedCompositeFieldContainer[global___UpdatedTitle]: ...

    def __init__(self,
        *,
        titles : typing.Optional[typing.Iterable[global___UpdatedTitle]] = ...,
        ) -> None: ...
    def ClearField(self, field_name: typing_extensions.Literal[u"titles",b"titles"]) -> None: ...
global___UpdatedTitleGroup = UpdatedTitleGroup

class WebHomeView(google.protobuf.message.Message):
    DESCRIPTOR: google.protobuf.descriptor.Descriptor = ...
    GROUPS_FIELD_NUMBER: builtins.int

    @property
    def groups(self) -> google.protobuf.internal.containers.RepeatedCompositeFieldContainer[global___UpdatedTitleGroup]: ...

    def __init__(self,
        *,
        groups : typing.Optional[typing.Iterable[global___UpdatedTitleGroup]] = ...,
        ) -> None: ...
    def ClearField(self, field_name: typing_extensions.Literal[u"groups",b"groups"]) -> None: ...
global___WebHomeView = WebHomeView

class Popup(google.protobuf.message.Message):
    DESCRIPTOR: google.protobuf.descriptor.Descriptor = ...
    SUBJECT_FIELD_NUMBER: builtins.int
    BODY_FIELD_NUMBER: builtins.int
    subject: typing.Text = ...
    body: typing.Text = ...

    def __init__(self,
        *,
        subject : typing.Text = ...,
        body : typing.Text = ...,
        ) -> None: ...
    def ClearField(self, field_name: typing_extensions.Literal[u"body",b"body",u"subject",b"subject"]) -> None: ...
global___Popup = Popup

class Title(google.protobuf.message.Message):
    DESCRIPTOR: google.protobuf.descriptor.Descriptor = ...
    class _Language(google.protobuf.internal.enum_type_wrapper._EnumTypeWrapper[Language.V], builtins.type):
        DESCRIPTOR: google.protobuf.descriptor.EnumDescriptor = ...
        ENGLISH = Title.Language.V(0)
        SPANISH = Title.Language.V(1)
    class Language(metaclass=_Language):
        V = typing.NewType('V', builtins.int)
    ENGLISH = Title.Language.V(0)
    SPANISH = Title.Language.V(1)

    TITLE_ID_FIELD_NUMBER: builtins.int
    NAME_FIELD_NUMBER: builtins.int
    AUTHOR_FIELD_NUMBER: builtins.int
    PORTRAIT_IMAGE_URL_FIELD_NUMBER: builtins.int
    LANDSCAPE_IMAGE_URL_FIELD_NUMBER: builtins.int
    VIEW_COUNT_FIELD_NUMBER: builtins.int
    LANGUAGE_FIELD_NUMBER: builtins.int
    title_id: builtins.int = ...
    name: typing.Text = ...
    author: typing.Text = ...
    portrait_image_url: typing.Text = ...
    landscape_image_url: typing.Text = ...
    view_count: builtins.int = ...
    language: global___Title.Language.V = ...

    def __init__(self,
        *,
        title_id : builtins.int = ...,
        name : typing.Text = ...,
        author : typing.Text = ...,
        portrait_image_url : typing.Text = ...,
        landscape_image_url : typing.Text = ...,
        view_count : builtins.int = ...,
        language : global___Title.Language.V = ...,
        ) -> None: ...
    def ClearField(self, field_name: typing_extensions.Literal[u"author",b"author",u"landscape_image_url",b"landscape_image_url",u"language",b"language",u"name",b"name",u"portrait_image_url",b"portrait_image_url",u"title_id",b"title_id",u"view_count",b"view_count"]) -> None: ...
global___Title = Title

class Chapter(google.protobuf.message.Message):
    DESCRIPTOR: google.protobuf.descriptor.Descriptor = ...
    TITLE_ID_FIELD_NUMBER: builtins.int
    CHAPTER_ID_FIELD_NUMBER: builtins.int
    NAME_FIELD_NUMBER: builtins.int
    SUB_TITLE_FIELD_NUMBER: builtins.int
    THUMBNAIL_URL_FIELD_NUMBER: builtins.int
    START_TIMESTAMP_FIELD_NUMBER: builtins.int
    END_TIMESTAMP_FIELD_NUMBER: builtins.int
    title_id: builtins.int = ...
    chapter_id: builtins.int = ...
    name: typing.Text = ...
    sub_title: typing.Text = ...
    thumbnail_url: typing.Text = ...
    start_timestamp: builtins.int = ...
    end_timestamp: builtins.int = ...

    def __init__(self,
        *,
        title_id : builtins.int = ...,
        chapter_id : builtins.int = ...,
        name : typing.Text = ...,
        sub_title : typing.Text = ...,
        thumbnail_url : typing.Text = ...,
        start_timestamp : builtins.int = ...,
        end_timestamp : builtins.int = ...,
        ) -> None: ...
    def ClearField(self, field_name: typing_extensions.Literal[u"chapter_id",b"chapter_id",u"end_timestamp",b"end_timestamp",u"name",b"name",u"start_timestamp",b"start_timestamp",u"sub_title",b"sub_title",u"thumbnail_url",b"thumbnail_url",u"title_id",b"title_id"]) -> None: ...
global___Chapter = Chapter

class TitleDetailView(google.protobuf.message.Message):
    DESCRIPTOR: google.protobuf.descriptor.Descriptor = ...
    class _UpdateTiming(google.protobuf.internal.enum_type_wrapper._EnumTypeWrapper[UpdateTiming.V], builtins.type):
        DESCRIPTOR: google.protobuf.descriptor.EnumDescriptor = ...
        NOT_REGULARLY = TitleDetailView.UpdateTiming.V(0)
        MONDAY = TitleDetailView.UpdateTiming.V(1)
        TUESDAY = TitleDetailView.UpdateTiming.V(2)
        WEDNESDAY = TitleDetailView.UpdateTiming.V(3)
        THURSDAY = TitleDetailView.UpdateTiming.V(4)
        FRIDAY = TitleDetailView.UpdateTiming.V(5)
        SATURDAY = TitleDetailView.UpdateTiming.V(6)
        SUNDAY = TitleDetailView.UpdateTiming.V(7)
        DAY = TitleDetailView.UpdateTiming.V(8)
    class UpdateTiming(metaclass=_UpdateTiming):
        V = typing.NewType('V', builtins.int)
    NOT_REGULARLY = TitleDetailView.UpdateTiming.V(0)
    MONDAY = TitleDetailView.UpdateTiming.V(1)
    TUESDAY = TitleDetailView.UpdateTiming.V(2)
    WEDNESDAY = TitleDetailView.UpdateTiming.V(3)
    THURSDAY = TitleDetailView.UpdateTiming.V(4)
    FRIDAY = TitleDetailView.UpdateTiming.V(5)
    SATURDAY = TitleDetailView.UpdateTiming.V(6)
    SUNDAY = TitleDetailView.UpdateTiming.V(7)
    DAY = TitleDetailView.UpdateTiming.V(8)

    TITLE_FIELD_NUMBER: builtins.int
    TITLE_IMAGE_URL_FIELD_NUMBER: builtins.int
    OVERVIEW_FIELD_NUMBER: builtins.int
    BACKGROUND_IMAGE_URL_FIELD_NUMBER: builtins.int
    NEXT_TIMESTAMP_FIELD_NUMBER: builtins.int
    UPDATE_TIMING_FIELD_NUMBER: builtins.int
    VIEWING_PERIOD_DESCRIPTION_FIELD_NUMBER: builtins.int
    NON_APPEARANCE_INFO_FIELD_NUMBER: builtins.int
    FIRST_CHAPTER_LIST_FIELD_NUMBER: builtins.int
    LAST_CHAPTER_LIST_FIELD_NUMBER: builtins.int
    RECOMMENDED_TITLES_FIELD_NUMBER: builtins.int
    IS_SIMUL_RELEASE_FIELD_NUMBER: builtins.int
    CHAPTERS_DESCENDING_FIELD_NUMBER: builtins.int
    title_image_url: typing.Text = ...
    overview: typing.Text = ...
    background_image_url: typing.Text = ...
    next_timestamp: builtins.int = ...
    update_timing: global___TitleDetailView.UpdateTiming.V = ...
    viewing_period_description: typing.Text = ...
    non_appearance_info: typing.Text = ...
    is_simul_release: builtins.bool = ...
    chapters_descending: builtins.bool = ...

    @property
    def title(self) -> global___Title: ...

    @property
    def first_chapter_list(self) -> google.protobuf.internal.containers.RepeatedCompositeFieldContainer[global___Chapter]: ...

    @property
    def last_chapter_list(self) -> google.protobuf.internal.containers.RepeatedCompositeFieldContainer[global___Chapter]: ...

    @property
    def recommended_titles(self) -> google.protobuf.internal.containers.RepeatedCompositeFieldContainer[global___Title]: ...

    def __init__(self,
        *,
        title : typing.Optional[global___Title] = ...,
        title_image_url : typing.Text = ...,
        overview : typing.Text = ...,
        background_image_url : typing.Text = ...,
        next_timestamp : builtins.int = ...,
        update_timing : global___TitleDetailView.UpdateTiming.V = ...,
        viewing_period_description : typing.Text = ...,
        non_appearance_info : typing.Text = ...,
        first_chapter_list : typing.Optional[typing.Iterable[global___Chapter]] = ...,
        last_chapter_list : typing.Optional[typing.Iterable[global___Chapter]] = ...,
        recommended_titles : typing.Optional[typing.Iterable[global___Title]] = ...,
        is_simul_release : builtins.bool = ...,
        chapters_descending : builtins.bool = ...,
        ) -> None: ...
    def HasField(self, field_name: typing_extensions.Literal[u"title",b"title"]) -> builtins.bool: ...
    def ClearField(self, field_name: typing_extensions.Literal[u"background_image_url",b"background_image_url",u"chapters_descending",b"chapters_descending",u"first_chapter_list",b"first_chapter_list",u"is_simul_release",b"is_simul_release",u"last_chapter_list",b"last_chapter_list",u"next_timestamp",b"next_timestamp",u"non_appearance_info",b"non_appearance_info",u"overview",b"overview",u"recommended_titles",b"recommended_titles",u"title",b"title",u"title_image_url",b"title_image_url",u"update_timing",b"update_timing",u"viewing_period_description",b"viewing_period_description"]) -> None: ...
global___TitleDetailView = TitleDetailView

class AllTitlesView(google.protobuf.message.Message):
    DESCRIPTOR: google.protobuf.descriptor.Descriptor = ...
    TITLES_FIELD_NUMBER: builtins.int

    @property
    def titles(self) -> google.protobuf.internal.containers.RepeatedCompositeFieldContainer[global___Title]: ...

    def __init__(self,
        *,
        titles : typing.Optional[typing.Iterable[global___Title]] = ...,
        ) -> None: ...
    def ClearField(self, field_name: typing_extensions.Literal[u"titles",b"titles"]) -> None: ...
global___AllTitlesView = AllTitlesView

class SuccessResult(google.protobuf.message.Message):
    DESCRIPTOR: google.protobuf.descriptor.Descriptor = ...
    ALL_TITLES_FIELD_NUMBER: builtins.int
    TITLE_DETAIL_FIELD_NUMBER: builtins.int
    WEB_HOME_VIEW_FIELD_NUMBER: builtins.int

    @property
    def all_titles(self) -> global___AllTitlesView: ...

    @property
    def title_detail(self) -> global___TitleDetailView: ...

    @property
    def web_home_view(self) -> global___WebHomeView: ...

    def __init__(self,
        *,
        all_titles : typing.Optional[global___AllTitlesView] = ...,
        title_detail : typing.Optional[global___TitleDetailView] = ...,
        web_home_view : typing.Optional[global___WebHomeView] = ...,
        ) -> None: ...
    def HasField(self, field_name: typing_extensions.Literal[u"all_titles",b"all_titles",u"result",b"result",u"title_detail",b"title_detail",u"web_home_view",b"web_home_view"]) -> builtins.bool: ...
    def ClearField(self, field_name: typing_extensions.Literal[u"all_titles",b"all_titles",u"result",b"result",u"title_detail",b"title_detail",u"web_home_view",b"web_home_view"]) -> None: ...
    def WhichOneof(self, oneof_group: typing_extensions.Literal[u"result",b"result"]) -> typing_extensions.Literal["all_titles","title_detail","web_home_view"]: ...
global___SuccessResult = SuccessResult

class ErrorResult(google.protobuf.message.Message):
    DESCRIPTOR: google.protobuf.descriptor.Descriptor = ...
    ACTION_FIELD_NUMBER: builtins.int
    ENGLISH_POPUP_FIELD_NUMBER: builtins.int
    SPANISH_POPUP_FIELD_NUMBER: builtins.int
    DEBUG_INFO_FIELD_NUMBER: builtins.int
    action: global___Action.V = ...
    debug_info: typing.Text = ...

    @property
    def english_popup(self) -> global___Popup: ...

    @property
    def spanish_popup(self) -> global___Popup: ...

    def __init__(self,
        *,
        action : global___Action.V = ...,
        english_popup : typing.Optional[global___Popup] = ...,
        spanish_popup : typing.Optional[global___Popup] = ...,
        debug_info : typing.Text = ...,
        ) -> None: ...
    def HasField(self, field_name: typing_extensions.Literal[u"english_popup",b"english_popup",u"spanish_popup",b"spanish_popup"]) -> builtins.bool: ...
    def ClearField(self, field_name: typing_extensions.Literal[u"action",b"action",u"debug_info",b"debug_info",u"english_popup",b"english_popup",u"spanish_popup",b"spanish_popup"]) -> None: ...
global___ErrorResult = ErrorResult

class Response(google.protobuf.message.Message):
    DESCRIPTOR: google.protobuf.descriptor.Descriptor = ...
    SUCCESS_RESULT_FIELD_NUMBER: builtins.int
    ERROR_RESULT_FIELD_NUMBER: builtins.int

    @property
    def success_result(self) -> global___SuccessResult: ...

    @property
    def error_result(self) -> global___ErrorResult: ...

    def __init__(self,
        *,
        success_result : typing.Optional[global___SuccessResult] = ...,
        error_result : typing.Optional[global___ErrorResult] = ...,
        ) -> None: ...
    def HasField(self, field_name: typing_extensions.Literal[u"error_result",b"error_result",u"success_result",b"success_result"]) -> builtins.bool: ...
    def ClearField(self, field_name: typing_extensions.Literal[u"error_result",b"error_result",u"success_result",b"success_result"]) -> None: ...
global___Response = Response
