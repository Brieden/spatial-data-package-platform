# pylint: disable=no-member,unused-argument
import graphene
from graphene.types import generic
from graphene_django.types import DjangoObjectType
from graphene_django.filter import DjangoFilterConnectionField
# from sorl.thumbnail import get_thumbnail
from gsmap.models import Municipality, Snapshot


class ThumbnailNode(graphene.ObjectType):
    url = graphene.String()
    size = graphene.String()

    #def resolve_url(self, info, size=size, **kwargs):
    #    instance = get_thumbnail(self, size)
    #    print(kwargs)
    #    return "xxx"


class ImageNode(graphene.ObjectType):
    url = graphene.String()
    thumbnail = graphene.Field(ThumbnailNode, size=graphene.String())

    def resolve_url(self, info):
        return self.url

    def resolve_thumbnail(self, info, size):
        return ThumbnailNode(self, size=size)


class SnapshotNode(DjangoObjectType):
    class Meta:
        model = Snapshot
        fields = ['title', 'topic', 'data', 'screenshot', 'municipality']
        filter_fields = ['municipality__id', 'municipality__canton']
        interfaces = [graphene.relay.Node]

    data = generic.GenericScalar(source='data')
    screenshot = graphene.Field(ImageNode)
    pk = graphene.String(source='id')


class MunicipalityNode(DjangoObjectType):
    class Meta:
        model = Municipality
        fields = ['name', 'canton']
        filter_fields = {
            'name': ['exact', 'icontains', 'istartswith'],
            'canton': ['exact']
        }
        interfaces = [graphene.relay.Node]

    bfs_number = graphene.Int(source='pk')
    fullname = graphene.String(source='fullname')
    snapshots = graphene.List(SnapshotNode)

    def resolve_snapshots(self, info):
        return Snapshot.objects.filter(municipality__id=self.pk)


class Query(object):
    municipality = graphene.relay.Node.Field(MunicipalityNode)
    municipalities = DjangoFilterConnectionField(MunicipalityNode)

    snapshot = graphene.relay.Node.Field(SnapshotNode)
    snapshots = DjangoFilterConnectionField(SnapshotNode)
